import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, title: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    settings: settings
      ? { ...settings, smtpPass: settings.smtpPass ? "••••••••" : "" }
      : null,
    users,
  });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.action === "add_user") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const title = String(body.title || "Project Engineer").trim();
    const role = body.role === "ADMIN" ? "ADMIN" : "STAFF";

    if (!name || !email || password.length < 6) {
      return NextResponse.json(
        { error: "Name, valid email, and password (min 6 chars) are required." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: { name, email, passwordHash, role, title },
      select: { id: true, name: true, email: true, role: true, title: true, createdAt: true },
    });
    return NextResponse.json({ user: created }, { status: 201 });
  }

  const updateData: Record<string, string | number> = {
    companyName: String(body.companyName || "Standard Roofs").trim(),
    tagline: String(body.tagline || "Document Signing & Approvals").trim(),
    website: String(body.website || "https://www.standardroofs.in").trim(),
    email: String(body.email || "info@standardroofs.in").trim(),
    phone: String(body.phone || "+91-86084-75787").trim(),
    address: String(body.address || "Erode, Tamil Nadu, India").trim(),
    publicBaseUrl: String(body.publicBaseUrl || "").trim().replace(/\/+$/, ""),
    smtpHost: String(body.smtpHost || "").trim(),
    smtpPort: Number(body.smtpPort || 587),
    smtpUser: String(body.smtpUser || "").trim(),
    smtpFrom: String(body.smtpFrom || "Standard Roofs <info@standardroofs.in>").trim(),
    whatsappWebhookUrl: String(body.whatsappWebhookUrl || "").trim(),
    smsWebhookUrl: String(body.smsWebhookUrl || "").trim(),
    fast2smsApiKey: String(body.fast2smsApiKey || "").trim(),
    googleMapsApiKey: String(body.googleMapsApiKey || "").trim(),
  };

  if (body.smtpPass && body.smtpPass !== "••••••••") {
    updateData.smtpPass = String(body.smtpPass);
  }

  const updated = await prisma.companySettings.upsert({
    where: { id: "default" },
    update: updateData,
    create: {
      id: "default",
      ...updateData,
    },
  });

  if (user.activeOrg?.id) {
    await prisma.organization.update({
      where: { id: user.activeOrg.id },
      data: {
        publicBaseUrl: updateData.publicBaseUrl as string,
      },
    }).catch(() => {});
  }

  return NextResponse.json({
    settings: { ...updated, smtpPass: updated.smtpPass ? "••••••••" : "" },
  });
}

