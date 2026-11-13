import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import DriveClient from "@/components/DriveClient";

export const dynamic = "force-dynamic";

export default async function DrivePage() {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    redirect("/login");
  }

  const [templates, requests] = await Promise.all([
    prisma.template.findMany({
      where: { organizationId: user.activeOrg.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.signatureRequest.findMany({
      where: { organizationId: user.activeOrg.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const files = [
    ...requests
      .filter((r) => Boolean(r.signedPdfPath))
      .map((r) => ({
        id: r.id,
        kind: "SIGNED" as const,
        name: `${r.title} (Signed + Audit).pdf`,
        category: r.category,
        sizeBytes: r.fileSizeBytes,
        createdAt: (r.completedAt || r.createdAt).toISOString(),
        downloadUrl: `/api/requests/${r.id}/pdf?variant=signed&download=1`,
      })),
    ...requests.map((r) => ({
      id: r.id,
      kind: "ORIGINAL" as const,
      name: `${r.title} (Original).pdf`,
      category: r.category,
      sizeBytes: r.fileSizeBytes,
      createdAt: r.createdAt.toISOString(),
      downloadUrl: `/api/requests/${r.id}/pdf?variant=original&download=1`,
    })),
    ...templates.map((t) => ({
      id: t.id,
      kind: "TEMPLATE" as const,
      name: `${t.name} (Template).pdf`,
      category: t.category,
      sizeBytes: t.fileSizeBytes,
      createdAt: t.createdAt.toISOString(),
      downloadUrl: `/api/templates/${t.id}/pdf`,
    })),
  ];

  const totalUsed =
    user.activeOrg.storageUsedBytes > BigInt(0)
      ? user.activeOrg.storageUsedBytes
      : BigInt(
          templates.reduce((acc, t) => acc + t.fileSizeBytes, 0) +
            requests.reduce((acc, r) => acc + r.fileSizeBytes, 0)
        );

  return (
    <AppShell user={user}>
      <DriveClient
        orgName={user.activeOrg.name}
        plan={user.activeOrg.plan}
        usedBytes={totalUsed.toString()}
        quotaBytes={user.activeOrg.storageQuotaBytes.toString()}
        files={files}
      />
    </AppShell>
  );
}

