import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    redirect("/login");
  }

  const [settings, memberships] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.membership.findMany({
      where: { organizationId: user.activeOrg.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const currentMembership = memberships.find((m) => m.userId === user.id);
  const activeRole = currentMembership?.role || user.role;

  const users = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    title: m.user.title,
  }));

  return (
    <AppShell user={user}>
      <SettingsClient
        initialSettings={{
          companyName: user.activeOrg.name || settings?.companyName || "Standard Roofs",
          tagline: user.activeOrg.tagline || settings?.tagline || "Document Signing & Approvals",
          website: user.activeOrg.website || settings?.website || "https://www.standardroofs.in",
          email: user.activeOrg.email || settings?.email || "info@standardroofs.in",
          phone: user.activeOrg.phone || settings?.phone || "+91-86084-75787",
          address: user.activeOrg.address || settings?.address || "Erode, Tamil Nadu, India",
          publicBaseUrl: user.activeOrg.publicBaseUrl || settings?.publicBaseUrl || "",
          smtpHost: user.activeOrg.smtpHost || settings?.smtpHost || "",
          smtpPort: user.activeOrg.smtpPort || settings?.smtpPort || 587,
          smtpUser: user.activeOrg.smtpUser || settings?.smtpUser || "",
          smtpPass: (user.activeOrg.smtpPass || settings?.smtpPass) ? "••••••••" : "",
          smtpFrom: user.activeOrg.smtpFrom || settings?.smtpFrom || "Standard Roofs <info@standardroofs.in>",
          whatsappWebhookUrl: user.activeOrg.whatsappWebhookUrl || settings?.whatsappWebhookUrl || "",
          smsWebhookUrl: user.activeOrg.smsWebhookUrl || settings?.smsWebhookUrl || "",
          fast2smsApiKey: user.activeOrg.fast2smsApiKey || settings?.fast2smsApiKey || "",
        }}
        initialUsers={users}
        currentUserRole={activeRole}
      />
    </AppShell>
  );
}
