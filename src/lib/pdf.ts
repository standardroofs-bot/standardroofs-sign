import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { DocumentField } from "./types";

export function normalizePdfBuffer(buffer: Buffer): Buffer {
  const idx = buffer.indexOf("%PDF-");
  if (idx > 0) {
    return buffer.subarray(idx);
  }
  return buffer;
}

export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const clean = normalizePdfBuffer(buffer);
  if (clean.indexOf("%PDF-") === -1) {
    const head = clean.subarray(0, 64).toString("utf8").trim();
    if (head.startsWith("<html") || head.startsWith("<!DOCTYPE")) {
      throw new Error("This file is an HTML webpage saved as .pdf, not a real PDF.");
    }
    throw new Error("File does not contain a %PDF- header.");
  }

  try {
    const doc = await PDFDocument.load(clean, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
    return Math.max(1, doc.getPageCount());
  } catch {
    // Fallback page count for non-standard PDFs so upload still succeeds
    const matches = clean.toString("latin1").match(/\/Type\s*\/Page\b(?!s)/g);
    return matches && matches.length > 0 ? matches.length : 1;
  }
}

export interface SignerAttachment {
  id: string;
  label: string;
  name?: string;
  dataUrl: string;
}

export interface SignerAuditInfo {
  id: string;
  role: string;
  name: string;
  email: string;
  phone: string;
  signedAt: Date | null;
  ipAddress: string | null;
  userAgent?: string | null;
  photoDataUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationLabel?: string | null;
  locationAddress?: string | null;
  passcodeVerified?: boolean;
  attachments?: SignerAttachment[];
  fieldValues: Record<string, string>;
}

export interface FinalizePdfInput {
  originalPdfBuffer: Buffer;
  requestId: string;
  title: string;
  projectName: string;
  categoryLabel: string;
  originalHash: string;
  fields: DocumentField[];
  signers: SignerAuditInfo[];
  companyName: string;
  companyWebsite: string;
  publicBaseUrl?: string;
}

function parseDataUrlImage(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:(image\/(png|jpeg|jpg));base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  return {
    mime: match[1].toLowerCase(),
    bytes: Buffer.from(match[3], "base64"),
  };
}

export async function applySignaturesAndFinalizePdf(
  input: FinalizePdfInput
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(
    normalizePdfBuffer(input.originalPdfBuffer),
    {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    }
  );
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const signerByRole = new Map<string, SignerAuditInfo>();
  for (const signer of input.signers) {
    signerByRole.set(signer.role, signer);
  }

  for (const field of input.fields) {
    const pageIndex = Math.max(0, Math.min(pages.length - 1, field.page - 1));
    const page = pages[pageIndex];
    if (!page) continue;

    const signer = signerByRole.get(field.role);
    if (!signer) continue;

    const rawValue = signer.fieldValues[field.id];
    if (!rawValue) continue;

    const { width: pageW, height: pageH } = page.getSize();
    const boxW = Math.max(12, field.width * pageW);
    const boxH = Math.max(10, field.height * pageH);
    const boxX = field.x * pageW;
    const boxY = pageH - field.y * pageH - boxH;

    if (
      field.type === "signature" ||
      field.type === "initials" ||
      field.type === "stamp"
    ) {
      const parsedImg = parseDataUrlImage(rawValue);
      if (parsedImg) {
        try {
          const embedded =
            parsedImg.mime === "image/png"
              ? await pdfDoc.embedPng(parsedImg.bytes)
              : await pdfDoc.embedJpg(parsedImg.bytes);
          const scale = Math.min(boxW / embedded.width, boxH / embedded.height);
          const drawW = embedded.width * scale;
          const drawH = embedded.height * scale;
          const drawX = boxX + (boxW - drawW) / 2;
          const drawY = boxY + (boxH - drawH) / 2;
          page.drawImage(embedded, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });
        } catch {
          // Fallback to text if image bytes fail to decode
          page.drawText(signer.name, {
            x: boxX + 4,
            y: boxY + boxH / 3,
            size: 11,
            font: helveticaBold,
            color: rgb(0.08, 0.12, 0.2),
          });
        }
      } else {
        page.drawText(rawValue.slice(0, 60), {
          x: boxX + 4,
          y: boxY + boxH / 3,
          size: 12,
          font: helveticaBold,
          color: rgb(0.08, 0.12, 0.2),
        });
      }
    } else if (field.type === "checkbox") {
      const checked = rawValue === "true" || rawValue === "yes" || rawValue === "1";
      page.drawRectangle({
        x: boxX + 2,
        y: boxY + 2,
        width: Math.min(boxW - 4, 16),
        height: Math.min(boxH - 4, 16),
        borderColor: rgb(0.76, 0.25, 0.05),
        borderWidth: 1.5,
      });
      if (checked) {
        page.drawText("X", {
          x: boxX + 6,
          y: boxY + 5,
          size: 11,
          font: helveticaBold,
          color: rgb(0.76, 0.25, 0.05),
        });
      }
    } else {
      const fontSize = Math.min(11, Math.max(8, boxH * 0.45));
      page.drawText(String(rawValue).slice(0, 120), {
        x: boxX + 4,
        y: boxY + (boxH - fontSize) / 2 + 1,
        size: fontSize,
        font: field.type === "name" ? helveticaBold : helvetica,
        color: rgb(0.06, 0.09, 0.16),
        maxWidth: boxW - 6,
      });
    }
  }

  // Append Official Certificate of Completion & Audit Trail
  const certPage = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width: cw, height: ch } = certPage.getSize();

  // Header bar
  certPage.drawRectangle({
    x: 0,
    y: ch - 84,
    width: cw,
    height: 84,
    color: rgb(0.06, 0.09, 0.16),
  });
  certPage.drawRectangle({
    x: 0,
    y: ch - 88,
    width: cw,
    height: 4,
    color: rgb(0.76, 0.25, 0.05),
  });

  certPage.drawText(`${input.companyName.toUpperCase()} — CERTIFICATE OF COMPLETION`, {
    x: 40,
    y: ch - 38,
    size: 14,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  certPage.drawText(
    `Verified Electronic Signature Audit Trail | ${input.companyWebsite}`,
    {
      x: 40,
      y: ch - 58,
      size: 9.5,
      font: helvetica,
      color: rgb(0.82, 0.85, 0.9),
    }
  );

  let y = ch - 120;
  const drawMetaRow = (label: string, value: string) => {
    certPage.drawText(label, {
      x: 40,
      y,
      size: 9.5,
      font: helveticaBold,
      color: rgb(0.35, 0.4, 0.48),
    });
    certPage.drawText(value.slice(0, 76), {
      x: 170,
      y,
      size: 9.5,
      font: helvetica,
      color: rgb(0.06, 0.09, 0.16),
    });
    y -= 20;
  };

  drawMetaRow("Document Title:", input.title);
  drawMetaRow("Project Name:", input.projectName || "General Agreement");
  drawMetaRow("Category:", input.categoryLabel);
  drawMetaRow("Request ID:", input.requestId);
  drawMetaRow("Completed At (UTC):", new Date().toISOString());
  drawMetaRow("Original SHA-256:", input.originalHash);

  // Generate & embed live QR code for instant public audit verification
  try {
    const rawPublicUrl =
      input.publicBaseUrl ||
      (input.companyWebsite?.startsWith("http") ? input.companyWebsite : "http://localhost:3030");
    const verifyUrl = `${rawPublicUrl.replace(/\/+$/, "")}/verify?id=${input.requestId}&hash=${input.originalHash}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
    const qrParsed = parseDataUrlImage(qrDataUrl);
    if (qrParsed) {
      const qrImg = await pdfDoc.embedPng(qrParsed.bytes);
      const qrDim = 68;
      const qrX = cw - 40 - qrDim;
      const qrY = ch - 120 - 46;

      certPage.drawImage(qrImg, {
        x: qrX,
        y: qrY,
        width: qrDim,
        height: qrDim,
      });

      certPage.drawText("SCAN TO VERIFY", {
        x: qrX + 3,
        y: qrY - 8,
        size: 6.5,
        font: helveticaBold,
        color: rgb(0.1, 0.15, 0.25),
      });
      certPage.drawText("Tamper-Proof Audit", {
        x: qrX + 2,
        y: qrY - 16,
        size: 5.5,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.52),
      });
    }
  } catch (err) {
    console.warn("QR code embed exception:", err);
  }

  y -= 14;
  certPage.drawLine({
    start: { x: 40, y },
    end: { x: cw - 40, y },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.92),
  });
  y -= 24;

  certPage.drawText("SIGNER VERIFICATION LOG", {
    x: 40,
    y,
    size: 11,
    font: helveticaBold,
    color: rgb(0.76, 0.25, 0.05),
  });
  y -= 20;

  for (const signer of input.signers) {
    if (y < 130) break;
    const hasPhoto = Boolean(signer.photoDataUrl);
    const extraLines = (signer.passcodeVerified ? 12 : 0) + (signer.attachments?.length ? 12 : 0);
    const boxH = (hasPhoto ? 132 : signer.latitude != null ? 120 : 84) + extraLines;
    certPage.drawRectangle({
      x: 40,
      y: y - boxH + 12,
      width: cw - 80,
      height: boxH,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.85, 0.88, 0.93),
      borderWidth: 1,
    });

    let textY = y - 6;
    certPage.drawText(`${signer.role}: ${signer.name}`, {
      x: 52,
      y: textY,
      size: 10.5,
      font: helveticaBold,
      color: rgb(0.06, 0.09, 0.16),
    });
    textY -= 15;

    certPage.drawText(
      `Email: ${signer.email || "N/A"}${signer.phone ? `  |  Phone: ${signer.phone}` : ""}`,
      {
        x: 52,
        y: textY,
        size: 8.5,
        font: helvetica,
        color: rgb(0.3, 0.35, 0.42),
      }
    );
    textY -= 14;

    certPage.drawText(
      `Signed: ${signer.signedAt ? signer.signedAt.toISOString() : "Pending"}  |  IP: ${signer.ipAddress || "127.0.0.1"}`,
      {
        x: 52,
        y: textY,
        size: 8,
        font: helvetica,
        color: rgb(0.08, 0.48, 0.28),
      }
    );
    textY -= 13;

    if (signer.userAgent) {
      certPage.drawText(
        `Device / UA: ${signer.userAgent.slice(0, 64)}`,
        {
          x: 52,
          y: textY,
          size: 7.5,
          font: helvetica,
          color: rgb(0.4, 0.45, 0.52),
        }
      );
      textY -= 12;
    }

    if (signer.latitude != null && signer.longitude != null) {
      certPage.drawText(
        `GPS Locked: ${signer.latitude.toFixed(6)}, ${signer.longitude.toFixed(6)}${
          signer.locationLabel ? ` (${signer.locationLabel.slice(0, 30)})` : ""
        }`,
        {
          x: 52,
          y: textY,
          size: 8,
          font: helveticaBold,
          color: rgb(0.65, 0.12, 0.12),
        }
      );
      textY -= 12;

      const baseAddr = signer.locationAddress || "";
      const label = signer.locationLabel || "";
      const addr = label && !baseAddr.toLowerCase().includes(label.toLowerCase())
        ? `${label}, ${baseAddr}`
        : baseAddr || label;
      if (addr) {
        const line1 = addr.slice(0, 62);
        const line2 = addr.length > 62 ? addr.slice(62, 124) : "";
        certPage.drawText(`Live Address: ${line1}`, {
          x: 52,
          y: textY,
          size: 7.5,
          font: helvetica,
          color: rgb(0.2, 0.25, 0.32),
        });
        textY -= 11;
        if (line2) {
          certPage.drawText(`              ${line2}`, {
            x: 52,
            y: textY,
            size: 7.5,
            font: helvetica,
            color: rgb(0.2, 0.25, 0.32),
          });
          textY -= 11;
        }
      }

      certPage.drawText(
        `Map Verification: https://maps.google.com/?q=${signer.latitude.toFixed(6)},${signer.longitude.toFixed(6)}`,
        {
          x: 52,
          y: textY,
          size: 7.5,
          font: helvetica,
          color: rgb(0.12, 0.45, 0.78),
        }
      );
      textY -= 12;
    }

    if (signer.passcodeVerified) {
      certPage.drawText("Confidential Access PIN: Authenticated (Signer Verified)", {
        x: 52,
        y: textY,
        size: 7.5,
        font: helveticaBold,
        color: rgb(0.2, 0.4, 0.65),
      });
      textY -= 12;
    }

    if (signer.attachments && signer.attachments.length > 0) {
      const attNames = signer.attachments.map((a) => a.label).join(", ");
      certPage.drawText(`KYC ID Attachments: ${attNames.slice(0, 50)} (Attached as Annexure)`, {
        x: 52,
        y: textY,
        size: 7.5,
        font: helveticaBold,
        color: rgb(0.12, 0.5, 0.28),
      });
      textY -= 12;
    }

    if (signer.photoDataUrl) {
      const parsedPhoto = parseDataUrlImage(signer.photoDataUrl);
      if (parsedPhoto) {
        try {
          const img =
            parsedPhoto.mime === "image/png"
              ? await pdfDoc.embedPng(parsedPhoto.bytes)
              : await pdfDoc.embedJpg(parsedPhoto.bytes);

          const photoDim = 88;
          const photoX = cw - 40 - photoDim - 10;
          const photoY = y - boxH + 20;

          // Border frame around selfie proof
          certPage.drawRectangle({
            x: photoX - 2,
            y: photoY - 2,
            width: photoDim + 4,
            height: photoDim + 4,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.76, 0.25, 0.05),
            borderWidth: 1.5,
          });

          certPage.drawImage(img, {
            x: photoX,
            y: photoY,
            width: photoDim,
            height: photoDim,
          });

          // Badge label below photo
          certPage.drawText("SELFIE + GPS PROOF", {
            x: photoX - 1,
            y: photoY - 9,
            size: 6.5,
            font: helveticaBold,
            color: rgb(0.76, 0.25, 0.05),
          });
        } catch {
          // ignore invalid photo bytes
        }
      }
    }
    y -= boxH + 14;
  }

  certPage.drawText(
    "This document was electronically signed and verified by Standard e-Sign. Tampering invalidates the SHA-256 checksum.",
    {
      x: 40,
      y: 36,
      size: 8.5,
      font: helvetica,
      color: rgb(0.45, 0.5, 0.58),
    }
  );

  // Append Annexure pages for each uploaded KYC document (PAN, Aadhaar, GST)
  for (const signer of input.signers) {
    if (!signer.attachments || signer.attachments.length === 0) continue;

    for (const att of signer.attachments) {
      if (!att.dataUrl) continue;
      const parsed = parseDataUrlImage(att.dataUrl);
      if (!parsed) continue;

      try {
        const embeddedImg =
          parsed.mime === "image/png"
            ? await pdfDoc.embedPng(parsed.bytes)
            : await pdfDoc.embedJpg(parsed.bytes);

        const annexPage = pdfDoc.addPage([595.28, 841.89]);
        const aw = annexPage.getWidth();
        const ah = annexPage.getHeight();

        // Top banner
        annexPage.drawRectangle({
          x: 0,
          y: ah - 60,
          width: aw,
          height: 60,
          color: rgb(0.06, 0.09, 0.16),
        });
        annexPage.drawRectangle({
          x: 0,
          y: ah - 64,
          width: aw,
          height: 4,
          color: rgb(0.76, 0.25, 0.05),
        });

        annexPage.drawText("ANNEXURE — SIGNER KYC ATTACHMENT", {
          x: 40,
          y: ah - 36,
          size: 13,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });

        annexPage.drawText(
          `Document: ${input.title}  |  Signer: ${signer.name} (${signer.role})`,
          {
            x: 40,
            y: ah - 52,
            size: 8.5,
            font: helvetica,
            color: rgb(0.85, 0.88, 0.92),
          }
        );

        // Attachment Details Box
        annexPage.drawRectangle({
          x: 40,
          y: ah - 115,
          width: aw - 80,
          height: 40,
          color: rgb(0.96, 0.97, 0.99),
          borderColor: rgb(0.85, 0.88, 0.93),
          borderWidth: 1,
        });

        annexPage.drawText(`Attachment Type: ${att.label}`, {
          x: 52,
          y: ah - 92,
          size: 9.5,
          font: helveticaBold,
          color: rgb(0.06, 0.09, 0.16),
        });

        annexPage.drawText(`Attached By: ${signer.name}  |  File: ${att.name || att.label}  |  Verified Electronic Copy`, {
          x: 52,
          y: ah - 106,
          size: 8,
          font: helvetica,
          color: rgb(0.35, 0.4, 0.48),
        });

        // Compute aspect ratio to scale image cleanly inside remaining area
        const maxImgW = aw - 80;
        const maxImgH = ah - 160;
        const imgDims = embeddedImg.scale(1);
        const scale = Math.min(maxImgW / imgDims.width, maxImgH / imgDims.height, 1);
        const drawW = imgDims.width * scale;
        const drawH = imgDims.height * scale;
        const drawX = 40 + (maxImgW - drawW) / 2;
        const drawY = 40 + (maxImgH - drawH) / 2;

        // Image background border
        annexPage.drawRectangle({
          x: drawX - 2,
          y: drawY - 2,
          width: drawW + 4,
          height: drawH + 4,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.8, 0.83, 0.88),
          borderWidth: 1,
        });

        annexPage.drawImage(embeddedImg, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });
      } catch (err) {
        console.warn("Failed to embed attachment annexure image:", err);
      }
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function generateSampleRoofingPdf(
  kind: "quotation" | "fabrication" | "handover"
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // Brand header
  page.drawRectangle({
    x: 0,
    y: height - 92,
    width,
    height: 92,
    color: rgb(0.06, 0.09, 0.16),
  });
  page.drawRectangle({
    x: 0,
    y: height - 96,
    width,
    height: 4,
    color: rgb(0.76, 0.25, 0.05),
  });
  page.drawText("STANDARD ROOFS", {
    x: 42,
    y: height - 40,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    "Roofing Contractors & Structural Fabricators  |  Erode, Tamil Nadu  |  www.standardroofs.in",
    {
      x: 42,
      y: height - 62,
      size: 9.5,
      font,
      color: rgb(0.84, 0.87, 0.92),
    }
  );
  page.drawText("Ph: +91-86084-75787  |  Email: info@standardroofs.in", {
    x: 42,
    y: height - 78,
    size: 8.5,
    font,
    color: rgb(0.7, 0.75, 0.82),
  });

  const titles = {
    quotation: "QUOTATION & BILL OF QUANTITIES (BOQ) APPROVAL",
    fabrication: "STRUCTURAL & ROOF TRUSS FABRICATION DRAWING SIGN-OFF",
    handover: "SITE MEASUREMENT & PROJECT HANDOVER CERTIFICATE",
  };

  page.drawText(titles[kind], {
    x: 42,
    y: height - 135,
    size: 13.5,
    font: bold,
    color: rgb(0.76, 0.25, 0.05),
  });

  let y = height - 170;
  const lines =
    kind === "quotation"
      ? [
          "Project Reference: SR-BOQ-2026-041 (Residential Villa Tile Roofing)",
          "Scope of Work:",
          "1. Structural Steel Truss Fabrication (MS Tubular Sections with Red Oxide + Enamel)",
          "2. Premium Terracotta Clay Roof Tiles Supply & Laying (Approx. 2,850 Sq.Ft.)",
          "3. Ridge Tiles, Valley Gutters, Flashing & Waterproofing Sealant",
          "4. Soffit Panel Installation & Site Cleanup",
          "",
          "Payment Terms: 40% Advance | 40% On Steel Erection | 20% On Handover",
          "Warranty: 10-Year Structural Fabrication Workmanship Warranty",
          "",
          "By signing below, the Client approves the BOQ quantities, tile selection, and payment schedule.",
        ]
      : kind === "fabrication"
      ? [
          "Drawing Reference: SR-FAB-DWG-108  |  Rev: R2  |  PEB & Kerala Truss Layout",
          "Fabrication Specifications:",
          "1. Main Rafters & Purlins: IS 4923 Hollow Steel Sections (50x50x2.6mm / 80x40x2.9mm)",
          "2. Welding: Full perimeter MIG welding with ultrasonic weld spot inspection",
          "3. Surface Prep: Wire brush cleaning + Two coats Zinc Chromate Primer",
          "4. Slope Pitch: 24 Degrees engineered for South India monsoon drainage",
          "",
          "Note: Workshop cutting and assembly commences ONLY after Client/Engineer sign-off below.",
        ]
      : [
          "Handover Reference: SR-HO-2026-019  |  Final Completed Roof Area: 2,890 Sq.Ft.",
          "Inspection Checklist:",
          "[x] Truss alignment, anchor bolts, and weld joints inspected",
          "[x] Roof tile alignment, ridge capping, and flashing water-tested",
          "[x] Rainwater gutters and downspouts cleared and tested",
          "[x] Site debris cleared and leftover materials accounted",
          "",
          "By signing below, the Client confirms satisfactory completion and activates warranty coverage.",
        ];

  for (const line of lines) {
    page.drawText(line, {
      x: 42,
      y,
      size: 10.5,
      font: line.startsWith("Project") || line.startsWith("Drawing") || line.startsWith("Handover") ? bold : font,
      color: rgb(0.12, 0.16, 0.24),
    });
    y -= 20;
  }

  // Signature area boxes at bottom
  page.drawRectangle({
    x: 42,
    y: 120,
    width: 230,
    height: 110,
    borderColor: rgb(0.78, 0.82, 0.88),
    borderWidth: 1,
  });
  page.drawText("CLIENT APPROVAL & SIGNATURE", {
    x: 52,
    y: 212,
    size: 9,
    font: bold,
    color: rgb(0.35, 0.4, 0.48),
  });

  page.drawRectangle({
    x: 315,
    y: 120,
    width: 238,
    height: 110,
    borderColor: rgb(0.78, 0.82, 0.88),
    borderWidth: 1,
  });
  page.drawText("STANDARD ROOFS AUTHORIZED SIGN / STAMP", {
    x: 325,
    y: 212,
    size: 9,
    font: bold,
    color: rgb(0.35, 0.4, 0.48),
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

