import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { DRIVE_PLANS } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    activeOrg: user.activeOrg
      ? {
          ...user.activeOrg,
          storageQuotaBytes: user.activeOrg.storageQuotaBytes.toString(),
          storageUsedBytes: user.activeOrg.storageUsedBytes.toString(),
        }
      : null,
    organizations: user.organizations,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.action === "switch") {
    const orgId = String(body.organizationId || "");
    const allowed = user.organizations.some((o) => o.id === orgId);
    if (!allowed) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { activeOrgId: orgId },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create") {
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Organization name required" }, { status: 400 });
    }
    const baseSlug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) || "org";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        email: user.email,
        plan: "STARTER_10GB",
        storageQuotaBytes: DRIVE_PLANS.STARTER_10GB.quotaBytes,
        memberships: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { activeOrgId: org.id },
    });
    return NextResponse.json({ ok: true, organizationId: org.id }, { status: 201 });
  }

  if (body.action === "upgrade_plan" && user.activeOrg) {
    const planKey = String(body.plan || "STARTER_10GB") as keyof typeof DRIVE_PLANS;
    const plan = DRIVE_PLANS[planKey];
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    await prisma.organization.update({
      where: { id: user.activeOrg.id },
      data: {
        plan: plan.id,
        storageQuotaBytes: plan.quotaBytes,
      },
    });
    return NextResponse.json({ ok: true, plan: plan.id });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

