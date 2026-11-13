import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [settings, users] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <AppShell user={user}>
      <SettingsClient
        initialSettings={{
          companyName: settings?.companyName || "Standard Roofs",
          tagline:
            settings?.tagline || "Document Signing & Approvals",
          website: settings?.website || "https://www.standardroofs.in",
          email: settings?.email || "info@standardroofs.in",
          phone: settings?.phone || "+91-86084-75787",
          address: settings?.address || "Erode, Tamil Nadu, India",
          publicBaseUrl: settings?.publicBaseUrl || "",
          smtpHost: settings?.smtpHost || "",
          smtpPort: settings?.smtpPort || 587,
          smtpUser: settings?.smtpUser || "",
          smtpPass: settings?.smtpPass ? "••••••••" : "",
          smtpFrom: settings?.smtpFrom || "Standard Roofs <info@standardroofs.in>",
          whatsappWebhookUrl: settings?.whatsappWebhookUrl || "",
          smsWebhookUrl: settings?.smsWebhookUrl || "",
          fast2smsApiKey: settings?.fast2smsApiKey || "",
        }}
        initialUsers={users}
        currentUserRole={user.role}
      />
    </AppShell>
  );
}

