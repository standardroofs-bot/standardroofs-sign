import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PLANS, PlanTier } from "@/lib/plans";

// Security Gate: Super Admin only
async function checkSuperAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return null;
  }
  return user;
}

export async function GET() {
  const admin = await checkSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access Denied: Super Admin role required." }, { status: 403 });
  }

  // Aggregate Platform-wide Metrics
  const [
    totalOrganizations,
    activeOrganizations,
    totalUsers,
    totalRequests,
    completedRequests,
    organizations,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.signatureRequest.count(),
    prisma.signatureRequest.count({ where: { status: "COMPLETED" } }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: {
          select: { requests: true, templates: true },
        },
      },
    }),
  ]);

  let totalStorageBytes = BigInt(0);
  let estimatedMRR = 0;
  const tierCount = { FREE: 0, PRO: 0, ENTERPRISE: 0 };

  const serializedOrgs = organizations.map((org) => {
    const usedBytes = org.storageUsedBytes ?? BigInt(0);
    totalStorageBytes += usedBytes;

    const tier = (org.planTier || "FREE").toUpperCase() as PlanTier;
    if (tier === "PRO") {
      estimatedMRR += 1499;
      tierCount.PRO++;
    } else if (tier === "ENTERPRISE") {
      estimatedMRR += 4999;
      tierCount.ENTERPRISE++;
    } else {
      tierCount.FREE++;
    }

    const ownerMembership = org.memberships.find((m) => m.role === "OWNER") || org.memberships[0];

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      email: org.email,
      phone: org.phone,
      accountType: org.accountType,
      status: org.status || "ACTIVE",
      planTier: org.planTier || "FREE",
      monthlyDocLimit: org.monthlyDocLimit,
      docsSentThisMonth: org.docsSentThisMonth,
      storageUsedBytes: usedBytes.toString(),
      storageLimitBytes: (org.storageLimitBytes ?? BigInt(1073741824)).toString(),
      isEnterpriseDedicated: org.isEnterpriseDedicated ?? false,
      customDatabaseUrl: org.customDatabaseUrl || "",
      customStorageBucket: org.customStorageBucket || "",
      adminNotes: org.adminNotes || "",
      totalRequests: org._count.requests,
      totalTemplates: org._count.templates,
      memberCount: org.memberships.length,
      owner: ownerMembership ? {
        name: ownerMembership.user.name,
        email: ownerMembership.user.email,
      } : null,
      createdAt: org.createdAt.toISOString(),
    };
  });

  return NextResponse.json({
    metrics: {
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      totalRequests,
      completedRequests,
      totalStorageBytes: totalStorageBytes.toString(),
      estimatedMRR,
      tierCount,
    },
    organizations: serializedOrgs,
  });
}

export async function PATCH(req: Request) {
  const admin = await checkSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access Denied: Super Admin role required." }, { status: 403 });
  }

  const body = await req.json();
  const orgId = String(body.organizationId || "").trim();
  const action = String(body.action || "").trim();

  if (!orgId) {
    return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
  }

  if (action === "update_plan") {
    const newTier = (body.planTier || "FREE").toUpperCase() as PlanTier;
    const planConfig = PLANS[newTier] || PLANS.FREE;

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        planTier: newTier,
        monthlyDocLimit: body.monthlyDocLimit !== undefined ? Number(body.monthlyDocLimit) : planConfig.monthlyDocLimit,
        storageLimitBytes: body.storageLimitBytes !== undefined ? BigInt(body.storageLimitBytes) : planConfig.storageLimitBytes,
      },
    });

    return NextResponse.json({
      ok: true,
      organization: { ...updated, storageLimitBytes: updated.storageLimitBytes.toString() },
    });
  }

  if (action === "update_status") {
    const status = body.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { status },
    });
    return NextResponse.json({ ok: true, status: updated.status });
  }

  if (action === "update_dedicated") {
    const isDedicated = Boolean(body.isEnterpriseDedicated);
    const customDatabaseUrl = String(body.customDatabaseUrl || "").trim();
    const customStorageBucket = String(body.customStorageBucket || "").trim();

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        isEnterpriseDedicated: isDedicated,
        customDatabaseUrl,
        customStorageBucket,
      },
    });
    return NextResponse.json({ ok: true, organization: updated });
  }

  if (action === "save_notes") {
    const adminNotes = String(body.adminNotes || "").trim();
    await prisma.organization.update({
      where: { id: orgId },
      data: { adminNotes },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reset_usage") {
    await prisma.organization.update({
      where: { id: orgId },
      data: { docsSentThisMonth: 0 },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

export async function DELETE(req: Request) {
  const admin = await checkSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Access Denied: Super Admin role required." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("id");

  if (!orgId) {
    return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
  }

  // Prevent deleting the primary root organization
  if (orgId === "org_standard_roofs") {
    return NextResponse.json({ error: "Cannot delete the primary root organization." }, { status: 400 });
  }

  await prisma.organization.delete({
    where: { id: orgId },
  });

  return NextResponse.json({ ok: true });
}
