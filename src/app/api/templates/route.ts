import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { savePdfBuffer } from "@/lib/storage";
import {
  generateSampleRoofingPdf,
  getPdfPageCount,
  normalizePdfBuffer,
} from "@/lib/pdf";
import {
  convertDocxToPdf,
  convertSpreadsheetToPdf,
} from "@/lib/convertToPdf";
import { ROLE_COLORS } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.template.findMany({
    where: { organizationId: user.activeOrg.id },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      _count: { select: { requests: true } },
    },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const name = String(formData.get("name") || "").trim();
    const category = String(formData.get("category") || "QUOTATION_BOQ");
    const description = String(formData.get("description") || "").trim();
    const sampleKind = formData.get("sampleKind") as
      | "quotation"
      | "fabrication"
      | "handover"
      | null;
    const file = formData.get("file") as File | null;

    let pdfBuffer: Buffer;
    let defaultName = name;

    if (file && file.size > 0) {
      const arrayBuf = await file.arrayBuffer();
      const rawBuffer = Buffer.from(arrayBuf);
      const lowerName = file.name.toLowerCase();
      if (!defaultName) {
        defaultName = file.name.replace(/\.(pdf|docx|doc|xlsx|xls|csv)$/i, "");
      }

      if (lowerName.endsWith(".docx")) {
        pdfBuffer = await convertDocxToPdf(rawBuffer, defaultName || "Word Document");
      } else if (
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xls") ||
        lowerName.endsWith(".csv")
      ) {
        pdfBuffer = await convertSpreadsheetToPdf(
          rawBuffer,
          defaultName || "Spreadsheet"
        );
      } else if (lowerName.endsWith(".doc")) {
        return NextResponse.json(
          {
            error:
              "Legacy .doc binary format is not supported. Please Save As .docx or .pdf in Microsoft Word and upload.",
          },
          { status: 400 }
        );
      } else {
        pdfBuffer = normalizePdfBuffer(rawBuffer);
      }
    } else if (sampleKind) {
      pdfBuffer = await generateSampleRoofingPdf(sampleKind);
      if (!defaultName) {
        defaultName =
          sampleKind === "quotation"
            ? "Standard Roofs Quotation & BOQ"
            : sampleKind === "fabrication"
            ? "Fabrication Truss Drawing Approval"
            : "Site Measurement & Handover Certificate";
      }
    } else {
      return NextResponse.json(
        { error: "Please upload a PDF file or choose a sample roofing template." },
        { status: 400 }
      );
    }

    const pageCount = await getPdfPageCount(pdfBuffer);
    const saved = await savePdfBuffer("uploads", defaultName || "template", pdfBuffer);

    const org = await prisma.organization.findUnique({
      where: { id: user.activeOrg.id },
    });
    const currentUsed = org?.storageUsedBytes ?? BigInt(0);
    const storageLimit = org?.storageLimitBytes ?? org?.storageQuotaBytes ?? BigInt(1073741824);

    if (currentUsed + BigInt(saved.sizeBytes) > storageLimit) {
      return NextResponse.json(
        { error: "Organization Drive storage quota reached. Upgrade your Drive plan to upload more documents." },
        { status: 403 }
      );
    }

    const requirePhotoLocation = formData.get("requirePhotoLocation") === "true";

    const defaultRoles = [
      { name: "Client", color: ROLE_COLORS[0] },
      { name: "Standard Roofs Engineer", color: ROLE_COLORS[1] },
    ];

    const defaultFields = sampleKind
      ? [
          {
            id: "f_client_sig",
            role: "Client",
            type: "signature",
            label: "Client Signature",
            page: 1,
            x: 0.09,
            y: 0.76,
            width: 0.34,
            height: 0.08,
            required: true,
          },
          {
            id: "f_client_date",
            role: "Client",
            type: "date",
            label: "Date",
            page: 1,
            x: 0.09,
            y: 0.85,
            width: 0.22,
            height: 0.035,
            required: true,
          },
          {
            id: "f_sr_sig",
            role: "Standard Roofs Engineer",
            type: "signature",
            label: "Authorized Sign",
            page: 1,
            x: 0.55,
            y: 0.76,
            width: 0.34,
            height: 0.08,
            required: true,
          },
        ]
      : [];

    const template = await prisma.template.create({
      data: {
        organizationId: user.activeOrg.id,
        name: defaultName || "Untitled Roofing Template",
        category,
        description,
        pdfPath: saved.relativePath,
        fileSizeBytes: saved.sizeBytes,
        pageCount,
        originalHash: saved.hash,
        requirePhotoLocation,
        rolesJson: JSON.stringify(defaultRoles),
        fieldsJson: JSON.stringify(defaultFields),
        createdById: user.id,
      },
    });

    await prisma.organization.update({
      where: { id: user.activeOrg.id },
      data: { storageUsedBytes: { increment: BigInt(saved.sizeBytes) } },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    console.error("Create template error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not process PDF file. Ensure it is a valid PDF.",
      },
      { status: 400 }
    );
  }
}

