import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TemplateBuilderClient from "@/components/TemplateBuilderClient";

export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) {
    notFound();
  }

  return (
    <AppShell user={user}>
      <TemplateBuilderClient
        template={{
          id: template.id,
          name: template.name,
          category: template.category,
          description: template.description,
          requirePhotoLocation: template.requirePhotoLocation,
          roles: JSON.parse(template.rolesJson || "[]"),
          fields: JSON.parse(template.fieldsJson || "[]"),
        }}
      />
    </AppShell>
  );
}

