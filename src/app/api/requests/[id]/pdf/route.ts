import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { readPdfBuffer } from "@/lib/storage";
import { PDFDocument } from "pdf-lib";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const variant = searchParams.get("variant") || "signed";
  const download = searchParams.get("download") === "1";

  const request = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeName = request.title.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Variant: Download Section 65B Audit Certificate & Annexures only
  if (variant === "certificate" && request.signedPdfPath) {
    try {
      const fullBuffer = await readPdfBuffer(request.signedPdfPath);
      const origBuffer = await readPdfBuffer(request.originalPdfPath);
      const origDoc = await PDFDocument.load(origBuffer, { ignoreEncryption: true });
      const origPageCount = origDoc.getPageCount();

      const signedDoc = await PDFDocument.load(fullBuffer, { ignoreEncryption: true });
      const totalPageCount = signedDoc.getPageCount();

      if (totalPageCount > origPageCount) {
        const certDoc = await PDFDocument.create();
        const certPageIndices = Array.from(
          { length: totalPageCount - origPageCount },
          (_, i) => origPageCount + i
        );
        const copiedPages = await certDoc.copyPages(signedDoc, certPageIndices);
        copiedPages.forEach((p) => certDoc.addPage(p));
        const certBytes = await certDoc.save();
        return new NextResponse(new Uint8Array(certBytes), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}-AUDIT-CERTIFICATE.pdf"`,
            "Cache-Control": "no-store",
          },
        });
      }
    } catch (err) {
      console.warn("Failed extracting audit certificate only, falling back to full signed PDF:", err);
    }
  }

  const pathToRead =
    variant === "signed" && request.signedPdfPath
      ? request.signedPdfPath
      : request.originalPdfPath;

  const buffer = await readPdfBuffer(pathToRead);
  const suffix = variant === "signed" && request.signedPdfPath ? "-SIGNED" : "";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}${suffix}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

