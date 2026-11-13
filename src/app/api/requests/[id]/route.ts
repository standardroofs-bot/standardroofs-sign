import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const request = await prisma.signatureRequest.findUnique({
    where: { id },
    include: {
      signers: { orderBy: { orderIndex: "asc" } },
      auditEvents: { orderBy: { createdAt: "desc" }, include: { signer: true } },
      template: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({ request });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json();

  if (body.action === "void") {
    const updated = await prisma.signatureRequest.update({
      where: { id },
      data: { status: "VOIDED" },
    });
    await prisma.auditEvent.create({
      data: {
        requestId: id,
        action: "VOIDED",
        details: `Voided by ${user.name}`,
      },
    });
    return NextResponse.json({ request: updated });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  await prisma.signatureRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

