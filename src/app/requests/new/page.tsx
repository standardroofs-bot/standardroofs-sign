import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import NewRequestClient from "@/components/NewRequestClient";
import type { DocumentField, SignerRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    redirect("/login");
  }

  const sp = await searchParams;
  const [templates, settings] = await Promise.all([
    prisma.template.findMany({
      where: { organizationId: user.activeOrg.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.companySettings.findUnique({ where: { id: "default" } }),
  ]);

  const options = templates.map((t) => {
    const roles = JSON.parse(t.rolesJson || "[]") as SignerRole[];
    const fields = JSON.parse(t.fieldsJson || "[]") as DocumentField[];
    const usedRoleNames = Array.from(new Set(fields.map((f) => f.role)));
    const activeRoles =
      usedRoleNames.length > 0
        ? roles.filter((r) => usedRoleNames.includes(r.name))
        : roles.slice(0, 1);

    return {
      id: t.id,
      name: t.name,
      category: t.category,
      roles:
        activeRoles.length > 0
          ? activeRoles
          : [{ name: "Recipient", color: "#991B1B" }],
    };
  });

  return (
    <AppShell user={user}>
      <NewRequestClient
        templates={options}
        initialTemplateId={sp.templateId}
        publicBaseUrl={user.activeOrg.publicBaseUrl || settings?.publicBaseUrl || ""}
      />
    </AppShell>
  );
}
