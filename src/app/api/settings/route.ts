import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Active Organization or default settings
  const org = user.activeOrg
    ? await prisma.organization.findUnique({ where: { id: user.activeOrg.id } })
    : null;
  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });

  // Get users belonging to active organization
  let users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    title: string;
    createdAt: Date;
  }> = [];

  if (user.activeOrg?.id) {
    const memberships = await prisma.membership.findMany({
      where: { organizationId: user.activeOrg.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, title: true, createdAt: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    users = memberships.map((m) => ({
      ...m.user,
      role: m.role,
    }));
  } else {
    users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, title: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  const combinedSettings = {
    companyName: org?.name || settings?.companyName || "Standard e-Sign",
    tagline: org?.tagline || settings?.tagline || "Document Signing & Approvals",
    website: org?.website || settings?.website || "https://www.standardesign.in",
    email: org?.email || settings?.email || "",
    phone: org?.phone || settings?.phone || "",
    address: org?.address || settings?.address || "",
    accentColor: org?.accentColor || settings?.accentColor || "#991B1B",
    publicBaseUrl: org?.publicBaseUrl || settings?.publicBaseUrl || "",
    smtpHost: org?.smtpHost || settings?.smtpHost || "",
    smtpPort: org?.smtpPort || settings?.smtpPort || 587,
    smtpUser: org?.smtpUser || settings?.smtpUser || "",
    smtpPass: (org?.smtpPass || settings?.smtpPass) ? "••••••••" : "",
    smtpFrom: org?.smtpFrom || settings?.smtpFrom || "",
    whatsappWebhookUrl: org?.whatsappWebhookUrl || settings?.whatsappWebhookUrl || "",
    smsWebhookUrl: org?.smsWebhookUrl || settings?.smsWebhookUrl || "",
    fast2smsApiKey: org?.fast2smsApiKey || settings?.fast2smsApiKey || "",
    googleMapsApiKey: settings?.googleMapsApiKey || "",
  };

  return NextResponse.json({
    settings: combinedSettings,
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
    const activeMembership = user.activeOrg
      ? await prisma.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: user.activeOrg.id,
            },
          },
        })
      : null;

    const isAdmin =
      user.role === "ADMIN" ||
      activeMembership?.role === "OWNER" ||
      activeMembership?.role === "ADMIN";

    if (!isAdmin) {
      return NextResponse.json({ error: "Admin role required to add team members." }, { status: 403 });
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const title = String(body.title || "Team Member").trim();
    const role = body.role === "ADMIN" ? "ADMIN" : "STAFF";

    if (!name || !email || password.length < 6) {
      return NextResponse.json(
        { error: "Name, valid email, and password (min 6 chars) are required." },
        { status: 400 }
      );
    }

    let existingUser = await prisma.user.findUnique({ where: { email } });

    if (!existingUser) {
      const passwordHash = await bcrypt.hash(password, 10);
      existingUser = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          title,
          activeOrgId: user.activeOrg?.id || null,
        },
      });
    }

    if (user.activeOrg?.id) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: user.activeOrg.id,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: "This user is already a member of your organization." },
          { status: 409 }
        );
      }

      await prisma.membership.create({
        data: {
          userId: existingUser.id,
          organizationId: user.activeOrg.id,
          role: role === "ADMIN" ? "ADMIN" : "MEMBER",
        },
      });
    }

    return NextResponse.json(
      {
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role,
          title: existingUser.title,
          createdAt: existingUser.createdAt,
        },
      },
      { status: 201 }
    );
  }

  const companyName = String(body.companyName || "").trim();
  const tagline = String(body.tagline || "").trim();
  const website = String(body.website || "").trim();
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  const address = String(body.address || "").trim();
  const publicBaseUrl = String(body.publicBaseUrl || "").trim().replace(/\/+$/, "");
  const smtpHost = String(body.smtpHost || "").trim();
  const smtpPort = Number(body.smtpPort || 587);
  const smtpUser = String(body.smtpUser || "").trim();
  const smtpFrom = String(body.smtpFrom || "").trim();
  const whatsappWebhookUrl = String(body.whatsappWebhookUrl || "").trim();
  const smsWebhookUrl = String(body.smsWebhookUrl || "").trim();
  const fast2smsApiKey = String(body.fast2smsApiKey || "").trim();
  const googleMapsApiKey = String(body.googleMapsApiKey || "").trim();

  const orgUpdate: Record<string, any> = {};
  if (companyName) orgUpdate.name = companyName;
  if (tagline !== undefined) orgUpdate.tagline = tagline;
  if (website !== undefined) orgUpdate.website = website;
  if (email !== undefined) orgUpdate.email = email;
  if (phone !== undefined) orgUpdate.phone = phone;
  if (address !== undefined) orgUpdate.address = address;
  if (publicBaseUrl !== undefined) orgUpdate.publicBaseUrl = publicBaseUrl;
  if (smtpHost !== undefined) orgUpdate.smtpHost = smtpHost;
  if (smtpPort !== undefined) orgUpdate.smtpPort = smtpPort;
  if (smtpUser !== undefined) orgUpdate.smtpUser = smtpUser;
  if (smtpFrom !== undefined) orgUpdate.smtpFrom = smtpFrom;
  if (whatsappWebhookUrl !== undefined) orgUpdate.whatsappWebhookUrl = whatsappWebhookUrl;
  if (smsWebhookUrl !== undefined) orgUpdate.smsWebhookUrl = smsWebhookUrl;
  if (fast2smsApiKey !== undefined) orgUpdate.fast2smsApiKey = fast2smsApiKey;

  if (body.smtpPass && body.smtpPass !== "••••••••") {
    orgUpdate.smtpPass = String(body.smtpPass);
  }

  if (user.activeOrg?.id) {
    await prisma.organization.update({
      where: { id: user.activeOrg.id },
      data: orgUpdate,
    });
  }

  // Also sync global settings for fallback or single-tenant default
  const settingsUpdate: Record<string, any> = {
    ...orgUpdate,
    ...(companyName ? { companyName } : {}),
    ...(googleMapsApiKey !== undefined ? { googleMapsApiKey } : {}),
  };
  delete settingsUpdate.name;

  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: settingsUpdate,
    create: {
      id: "default",
      companyName: companyName || "Standard e-Sign",
      ...settingsUpdate,
    },
  });

  return NextResponse.json({
    settings: {
      ...orgUpdate,
      companyName: companyName || user.activeOrg?.name || "Standard e-Sign",
      smtpPass: orgUpdate.smtpPass ? "••••••••" : "",
    },
  });
}
