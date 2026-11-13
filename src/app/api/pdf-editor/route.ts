import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePdfBuffer } from "@/lib/pdf";
import { savePdfBuffer } from "@/lib/storage";
import { ROLE_COLORS } from "@/lib/types";

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
    const saveAsTemplate = formData.get("saveAsTemplate") === "true";

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one PDF file." },
        { status: 400 }
      );
    }

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

    // Remove specified 1-based page numbers (e.g. "2, 4")
    if (removePagesRaw) {
      const toRemove = new Set(
        removePagesRaw
          .split(/[,\s]+/)
          .map((n) => parseInt(n, 10))
          .filter((n) => !Number.isNaN(n) && n >= 1)
      );
      const total = merged.getPageCount();
      // Remove in descending order so indices don't shift
      const indicesToRemove = Array.from(toRemove)
        .filter((p) => p <= total)
        .sort((a, b) => b - a);
      if (indicesToRemove.length < total) {
        for (const pNum of indicesToRemove) {
          merged.removePage(pNum - 1);
        }
      }
    }

    if (headerNote) {
      const font = await merged.embedFont(StandardFonts.HelveticaBold);
      for (const page of merged.getPages()) {
        const { height } = page.getSize();
        page.drawText(headerNote.slice(0, 90), {
          x: 28,
          y: height - 22,
          size: 9,
          font,
          color: rgb(0.6, 0.11, 0.11),
        });
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
      { error: "Failed to process PDF files." },
      { status: 400 }
    );
  }
}

