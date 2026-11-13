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
  const template = await prisma.template.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template });
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

  const updated = await prisma.template.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.category !== undefined ? { category: String(body.category) } : {}),
      ...(body.description !== undefined
        ? { description: String(body.description).trim() }
        : {}),
      ...(body.requirePhotoLocation !== undefined
        ? { requirePhotoLocation: Boolean(body.requirePhotoLocation) }
        : {}),
      ...(body.roles !== undefined ? { rolesJson: JSON.stringify(body.roles) } : {}),
      ...(body.fields !== undefined
        ? { fieldsJson: JSON.stringify(body.fields) }
        : {}),
    },
  });

  return NextResponse.json({ template: updated });
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
  await prisma.signatureRequest.updateMany({
    where: { templateId: id },
    data: { templateId: null },
  });
  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

