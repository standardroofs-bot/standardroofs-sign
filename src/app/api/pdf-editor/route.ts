import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePdfBuffer } from "@/lib/pdf";
import { savePdfBuffer } from "@/lib/storage";
import { ROLE_COLORS } from "@/lib/types";

export interface TextLineEdit {
  pageNumber: number;
  normX: number;
  normY: number;
  normW: number;
  normH: number;
  originalText: string;
  newText: string;
  isDeleted: boolean;
  fontSize?: number;
  fontFamily?: "Helvetica" | "Times" | "Courier";
  color?: string;
  isBold?: boolean;
  isItalic?: boolean;
}

export interface EditorElement {
  id: string;
  pageNumber: number; // 1-based original page number
  type: "whiteout" | "text" | "stamp" | "signature" | "highlight";
  normX: number; // 0..1
  normY: number; // 0..1
  normW: number; // 0..1
  normH: number; // 0..1
  text?: string;
  fontSize?: number;
  fontFamily?: "Helvetica" | "Times" | "Courier";
  color?: string; // hex #000000
  isBold?: boolean;
  isItalic?: boolean;
  dataUrl?: string; // base64 PNG
  stampText?: string;
  stampColor?: string;
}

export interface EditorPayload {
  deletedPages?: number[];
  rotations?: Record<string, number>; // pageNumber -> degrees (90, 180, 270)
  elements?: EditorElement[];
  textEdits?: TextLineEdit[];
}

function parseHexColor(hex?: string, defaultColor = { r: 0, g: 0, b: 0 }) {
  if (!hex || typeof hex !== "string") {
    return rgb(defaultColor.r, defaultColor.g, defaultColor.b);
  }
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return rgb(r, g, b);
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return rgb(defaultColor.r, defaultColor.g, defaultColor.b);
}

function selectFont(
  family: string | undefined,
  isBold: boolean | undefined,
  isItalic: boolean | undefined
): StandardFonts {
  const fam = (family || "Helvetica").toLowerCase();
  if (fam.includes("times")) {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (fam.includes("courier")) {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  // Helvetica
  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const outputName = String(formData.get("name") || "Edited-Document").trim();
    const headerNote = String(formData.get("headerNote") || "").trim();
    const removePagesRaw = String(formData.get("removePages") || "").trim();
    const editsRaw = String(formData.get("edits") || "").trim();
    const saveAsTemplate = formData.get("saveAsTemplate") === "true";

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one PDF file." },
        { status: 400 }
      );
    }

    let parsedEdits: EditorPayload = {
      deletedPages: [],
      rotations: {},
      elements: [],
      textEdits: [],
    };

    if (editsRaw) {
      try {
        parsedEdits = JSON.parse(editsRaw);
      } catch (e) {
        console.warn("Could not parse edits JSON:", e);
      }
    }

    // Combine legacy removePages string if passed
    if (removePagesRaw) {
      const legacyPages = removePagesRaw
        .split(/[,\s]+/)
        .map((n) => parseInt(n, 10))
        .filter((n) => !Number.isNaN(n) && n >= 1);
      parsedEdits.deletedPages = Array.from(
        new Set([...(parsedEdits.deletedPages || []), ...legacyPages])
      );
    }

    // Merge uploaded files into base document
    const merged = await PDFDocument.create();
    for (const file of files) {
      if (!file || file.size === 0) continue;
      const buf = normalizePdfBuffer(Buffer.from(await file.arrayBuffer()));
      const src = await PDFDocument.load(buf, {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      });
      const copiedPages = await merged.copyPages(src, src.getPageIndices());
      copiedPages.forEach((p) => merged.addPage(p));
    }

    const totalPagesOriginal = merged.getPageCount();
    if (totalPagesOriginal === 0) {
      return NextResponse.json(
        { error: "The provided file does not contain any readable PDF pages." },
        { status: 400 }
      );
    }

    // Embed common fonts
    const fontCache = new Map<StandardFonts, any>();
    async function getFont(sf: StandardFonts) {
      if (!fontCache.has(sf)) {
        fontCache.set(sf, await merged.embedFont(sf));
      }
      return fontCache.get(sf);
    }

    // 1. Apply Direct In-Place Text Line Edits (Word-style text editing & removal)
    if (parsedEdits.textEdits && parsedEdits.textEdits.length > 0) {
      for (const edit of parsedEdits.textEdits) {
        const pageIdx = edit.pageNumber - 1;
        if (pageIdx < 0 || pageIdx >= totalPagesOriginal) continue;

        const page = merged.getPage(pageIdx);
        const { width: pdfW, height: pdfH } = page.getSize();

        const boxW = Math.max(4, edit.normW * pdfW);
        const boxH = Math.max(4, edit.normH * pdfH);
        const boxX = edit.normX * pdfW;
        const boxY = pdfH - (edit.normY * pdfH) - boxH;

        const fontChoice = selectFont(edit.fontFamily, edit.isBold, edit.isItalic);
        const font = await getFont(fontChoice);
        const fontSize = Math.max(7, Math.min(72, edit.fontSize || Math.round(boxH * 0.75)));
        const textColor = parseHexColor(edit.color, { r: 0.05, g: 0.08, b: 0.15 });

        let clearWidth = boxW;
        if (edit.newText && edit.newText.trim().length > 0) {
          try {
            const measuredWidth = font.widthOfTextAtSize(edit.newText, fontSize);
            if (measuredWidth > clearWidth) {
              clearWidth = measuredWidth;
            }
          } catch (_) {}
        }

        // Whiteout the original text with a small padding so it is completely removed
        page.drawRectangle({
          x: Math.max(0, boxX - 1.5),
          y: Math.max(0, boxY - 1.5),
          width: clearWidth + 4,
          height: boxH + 3,
          color: rgb(1, 1, 1),
          opacity: 1,
        });

        // If not deleted and user entered replacement text, draw the new text
        if (!edit.isDeleted && edit.newText && edit.newText.trim().length > 0) {
          // In PDF, y is baseline
          const textY = boxY + Math.max(1, boxH * 0.22);

          page.drawText(edit.newText, {
            x: boxX,
            y: textY,
            size: fontSize,
            font,
            color: textColor,
          });
        }
      }
    }

    // 2. Apply Custom Added Visual Elements (whiteout, text, stamp, signature, highlight)
    if (parsedEdits.elements && parsedEdits.elements.length > 0) {
      for (const elem of parsedEdits.elements) {
        const pageIdx = elem.pageNumber - 1;
        if (pageIdx < 0 || pageIdx >= totalPagesOriginal) continue;

        const page = merged.getPage(pageIdx);
        const { width: pdfW, height: pdfH } = page.getSize();

        const w = Math.max(2, (elem.normW || 0.1) * pdfW);
        const h = Math.max(2, (elem.normH || 0.05) * pdfH);
        const x = (elem.normX || 0) * pdfW;
        const y = pdfH - ((elem.normY || 0) * pdfH) - h;

        if (elem.type === "whiteout") {
          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(1, 1, 1),
            opacity: 1,
          });
        } else if (elem.type === "highlight") {
          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: parseHexColor(elem.color, { r: 1, g: 0.92, b: 0.23 }),
            opacity: 0.38,
          });
        } else if (elem.type === "text") {
          const fontChoice = selectFont(elem.fontFamily, elem.isBold, elem.isItalic);
          const font = await getFont(fontChoice);
          const fontSize = Math.max(8, Math.min(72, elem.fontSize || 13));
          const textColor = parseHexColor(elem.color, { r: 0.06, g: 0.09, b: 0.16 });
          const rawLines = (elem.text || "").split("\n");

          let lineY = y + h - fontSize * 0.9;
          for (const line of rawLines) {
            if (line.trim().length > 0) {
              page.drawText(line, {
                x: x + 2,
                y: lineY,
                size: fontSize,
                font,
                color: textColor,
              });
            }
            lineY -= fontSize * 1.25;
          }
        } else if (elem.type === "stamp") {
          const stampLabel = (elem.stampText || elem.text || "APPROVED").toUpperCase();
          const stampHex = elem.stampColor || elem.color || "#16a34a";
          const stampCol = parseHexColor(stampHex, { r: 0.08, g: 0.5, b: 0.24 });
          const stampFont = await getFont(StandardFonts.HelveticaBold);

          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            borderColor: stampCol,
            borderWidth: 2.5,
            color: rgb(1, 1, 1),
            opacity: 0.92,
          });

          const fontSize = Math.max(9, Math.min(24, Math.floor(h * 0.45)));
          const textW = stampFont.widthOfTextAtSize(stampLabel, fontSize);
          const textX = Math.max(x + 4, x + (w - textW) / 2);
          const textY = y + (h - fontSize) / 2 + 1;

          page.drawText(stampLabel, {
            x: textX,
            y: textY,
            size: fontSize,
            font: stampFont,
            color: stampCol,
          });
        } else if (elem.type === "signature" && elem.dataUrl) {
          try {
            const base64Data = elem.dataUrl.includes(",")
              ? elem.dataUrl.split(",")[1]
              : elem.dataUrl;
            const imgBytes = Buffer.from(base64Data, "base64");
            const pngImage = await merged.embedPng(imgBytes);
            page.drawImage(pngImage, {
              x,
              y,
              width: w,
              height: h,
            });
          } catch (imgErr) {
            console.warn("Failed to embed signature PNG:", imgErr);
          }
        }
      }
    }

    // 3. Apply Optional Header Note
    if (headerNote) {
      const font = await getFont(StandardFonts.HelveticaBold);
      for (const page of merged.getPages()) {
        const { height, width } = page.getSize();
        page.drawRectangle({
          x: 0,
          y: height - 26,
          width,
          height: 26,
          color: rgb(0.97, 0.98, 0.99),
        });
        page.drawText(headerNote.slice(0, 100), {
          x: 28,
          y: height - 18,
          size: 9,
          font,
          color: rgb(0.55, 0.1, 0.1),
        });
      }
    }

    // 4. Apply Rotations
    if (parsedEdits.rotations) {
      for (const [pStr, deg] of Object.entries(parsedEdits.rotations)) {
        const pNum = parseInt(pStr, 10);
        if (pNum >= 1 && pNum <= totalPagesOriginal) {
          const page = merged.getPage(pNum - 1);
          const current = page.getRotation().angle;
          page.setRotation(degrees((current + deg) % 360));
        }
      }
    }

    // 5. Remove Deleted Pages
    if (parsedEdits.deletedPages && parsedEdits.deletedPages.length > 0) {
      const toRemove = Array.from(
        new Set(
          parsedEdits.deletedPages.filter(
            (p) => p >= 1 && p <= totalPagesOriginal
          )
        )
      ).sort((a, b) => b - a);

      if (toRemove.length < merged.getPageCount()) {
        for (const pNum of toRemove) {
          merged.removePage(pNum - 1);
        }
      }
    }

    const outBytes = Buffer.from(await merged.save());

    if (saveAsTemplate) {
      const saved = await savePdfBuffer("uploads", outputName, outBytes);
      const tpl = await prisma.template.create({
        data: {
          organizationId: user.activeOrg.id,
          name: outputName,
          category: "GENERAL",
          pdfPath: saved.relativePath,
          fileSizeBytes: saved.sizeBytes,
          pageCount: merged.getPageCount(),
          originalHash: saved.hash,
          rolesJson: JSON.stringify([{ name: "Client", color: ROLE_COLORS[0] }]),
          fieldsJson: "[]",
          createdById: user.id,
        },
      });
      await prisma.organization.update({
        where: { id: user.activeOrg.id },
        data: { storageUsedBytes: { increment: BigInt(saved.sizeBytes) } },
      });
      return NextResponse.json({ templateId: tpl.id }, { status: 201 });
    }

    return new NextResponse(new Uint8Array(outBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outputName.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF Editor error:", err);
    return NextResponse.json(
      { error: "Failed to process PDF file. Ensure it is not password-protected." },
      { status: 400 }
    );
  }
}
