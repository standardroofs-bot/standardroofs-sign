import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    redirect("/login");
  }

  const [requests, templateCount] = await Promise.all([
    prisma.signatureRequest.findMany({
      where: { organizationId: user.activeOrg.id },
      orderBy: { createdAt: "desc" },
      include: {
        signers: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            role: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            token: true,
          },
        },
      },
    }),
    prisma.template.count({
      where: { organizationId: user.activeOrg.id },
    }),
  ]);

  const serialized = requests.map((r) => ({
    id: r.id,
    title: r.title,
    projectName: r.projectName,
    category: r.category,
    status: r.status,
    hasSignedPdf: Boolean(r.signedPdfPath),
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    signers: r.signers,
  }));

  return (
    <AppShell user={user}>
      <DashboardClient requests={serialized} templateCount={templateCount} />
    </AppShell>
  );
}

