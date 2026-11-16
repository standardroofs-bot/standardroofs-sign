import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readPdfBuffer } from "@/lib/storage";
import { PDFDocument } from "pdf-lib";

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const { searchParams } = new URL(req.url);
  const variant = searchParams.get("variant") || "signed";
  const download = searchParams.get("download") === "1";

  const signer = await prisma.signer.findUnique({
    where: { token },
    include: { request: true },
  });

  if (!signer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Security gate: Confidential document requires passcode verification before serving PDF bytes
  const actualPasscode = signer.accessPasscode || signer.request.accessPasscode;
  if (actualPasscode && !signer.passcodeVerifiedAt && signer.status !== "SIGNED") {
    return NextResponse.json(
      { error: "Passcode verification required to access this confidential document." },
      { status: 403 }
    );
  }

  const safeName = signer.request.title.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Variant: Extract Audit Certificate & Annexures only
  if (variant === "certificate" && signer.request.signedPdfPath) {
    try {
      const fullBuffer = await readPdfBuffer(signer.request.signedPdfPath);
      const origBuffer = await readPdfBuffer(signer.request.originalPdfPath);
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
      console.warn("Failed extracting audit certificate only:", err);
    }
  }

  const pathToRead =
    variant === "signed" && signer.request.signedPdfPath
      ? signer.request.signedPdfPath
      : signer.request.originalPdfPath;

  const buffer = await readPdfBuffer(pathToRead);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}${variant === "signed" ? "-SIGNED" : ""}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

