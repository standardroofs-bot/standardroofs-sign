import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TemplatesClient from "@/components/TemplatesClient";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    redirect("/login");
  }

  const templates = await prisma.template.findMany({
    where: { organizationId: user.activeOrg.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { requests: true } },
    },
  });

  const serialized = templates.map((t) => {
    let fieldsCount = 0;
    try {
      fieldsCount = (JSON.parse(t.fieldsJson || "[]") as unknown[]).length;
    } catch {
      fieldsCount = 0;
    }
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      pageCount: t.pageCount,
      fieldsCount,
      requestsCount: t._count.requests,
      updatedAt: t.updatedAt.toISOString(),
    };
  });

  return (
    <AppShell user={user}>
      <TemplatesClient initialTemplates={serialized} />
    </AppShell>
  );
}

