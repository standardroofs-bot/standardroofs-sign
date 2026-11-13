import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { readPdfBuffer } from "@/lib/storage";

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
  const variant = searchParams.get("variant") === "signed" ? "signed" : "original";
  const download = searchParams.get("download") === "1";

  const request = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pathToRead =
    variant === "signed" && request.signedPdfPath
      ? request.signedPdfPath
      : request.originalPdfPath;

  const buffer = await readPdfBuffer(pathToRead);
  const safeName = request.title.replace(/[^a-zA-Z0-9_-]/g, "_");
  const suffix = variant === "signed" && request.signedPdfPath ? "-SIGNED" : "";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}${suffix}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

