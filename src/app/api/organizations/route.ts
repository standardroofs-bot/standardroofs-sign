import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { DRIVE_PLANS } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all members for the active organization
  const memberships = await prisma.membership.findMany({
    where: { organizationId: user.activeOrg.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, title: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const currentMembership = memberships.find((m) => m.userId === user.id);

  return NextResponse.json({
    activeOrg: {
      ...user.activeOrg,
      storageQuotaBytes: user.activeOrg.storageQuotaBytes.toString(),
      storageUsedBytes: user.activeOrg.storageUsedBytes.toString(),
      storageLimitBytes: (user.activeOrg.storageLimitBytes || user.activeOrg.storageQuotaBytes).toString(),
    },
    currentRole: currentMembership?.role || "MEMBER",
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role, // OWNER | ADMIN | MEMBER
      title: m.user.title,
      joinedAt: m.createdAt,
    })),
    organizations: user.organizations,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Find user's role in active organization
  const currentMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: user.activeOrg.id,
      },
    },
  });

  const isOwnerOrAdmin =
    currentMembership?.role === "OWNER" ||
    currentMembership?.role === "ADMIN" ||
    user.role === "ADMIN";

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

  // --- Team Management RBAC: Invite Member ---
  if (body.action === "invite_member") {
    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        { error: "Only Organization Owners and Admins can invite team members." },
        { status: 403 }
      );
    }

    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || email.split("@")[0] || "Staff").trim();
    const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
    const title = String(body.title || (role === "ADMIN" ? "Manager" : "Team Member")).trim();
    const password = String(body.password || "Welcome@2026");

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address required." }, { status: 400 });
    }

    // Check if user already exists or create new
    let targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      const passwordHash = await bcrypt.hash(password, 10);
      targetUser = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          title,
          role: role === "ADMIN" ? "ADMIN" : "STAFF",
          activeOrgId: user.activeOrg.id,
        },
      });
    }

    // Check if already a member of this organization
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUser.id,
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

    const newMembership = await prisma.membership.create({
      data: {
        userId: targetUser.id,
        organizationId: user.activeOrg.id,
        role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, title: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      member: {
        membershipId: newMembership.id,
        userId: newMembership.user.id,
        name: newMembership.user.name,
        email: newMembership.user.email,
        role: newMembership.role,
        title: newMembership.user.title,
      },
    }, { status: 201 });
  }

  // --- Team Management RBAC: Remove Member ---
  if (body.action === "remove_member") {
    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        { error: "Only Organization Owners and Admins can remove team members." },
        { status: 403 }
      );
    }

    const membershipId = String(body.membershipId || "");
    const targetMembership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!targetMembership || targetMembership.organizationId !== user.activeOrg.id) {
      return NextResponse.json({ error: "Membership not found in this organization." }, { status: 404 });
    }

    if (targetMembership.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove the Organization Owner." }, { status: 400 });
    }

    await prisma.membership.delete({ where: { id: membershipId } });
    return NextResponse.json({ ok: true, removed: membershipId });
  }

  // --- Upgrade Plan ---
  if (body.action === "upgrade_plan" && user.activeOrg) {
    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        { error: "Only Organization Owners and Admins can upgrade billing plans." },
        { status: 403 }
      );
    }
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
