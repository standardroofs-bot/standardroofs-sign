import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readPdfBuffer } from "@/lib/storage";

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const { searchParams } = new URL(req.url);
  const variant = searchParams.get("variant") === "signed" ? "signed" : "original";
  const download = searchParams.get("download") === "1";

  const signer = await prisma.signer.findUnique({
    where: { token },
    include: { request: true },
  });

  if (!signer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pathToRead =
    variant === "signed" && signer.request.signedPdfPath
      ? signer.request.signedPdfPath
      : signer.request.originalPdfPath;

  const buffer = await readPdfBuffer(pathToRead);
  const safeName = signer.request.title.replace(/[^a-zA-Z0-9_-]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}${variant === "signed" ? "-SIGNED" : ""}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

