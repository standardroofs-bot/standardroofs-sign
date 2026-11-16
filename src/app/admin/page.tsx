import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminDashboardClient from "@/components/AdminDashboardClient";
import { PLANS, PlanTier } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();

  // Strict Security Gate: Super Admin only
  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

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

    const ownerMembership =
      org.memberships.find((m) => m.role === "OWNER") || org.memberships[0];

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
      owner: ownerMembership
        ? {
            name: ownerMembership.user.name,
            email: ownerMembership.user.email,
          }
        : null,
      createdAt: org.createdAt.toISOString(),
    };
  });

  return (
    <AppShell user={user}>
      <AdminDashboardClient
        initialMetrics={{
          totalOrganizations,
          activeOrganizations,
          totalUsers,
          totalRequests,
          completedRequests,
          totalStorageBytes: totalStorageBytes.toString(),
          estimatedMRR,
          tierCount,
        }}
        initialOrganizations={serializedOrgs}
      />
    </AppShell>
  );
}
