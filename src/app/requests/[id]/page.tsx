import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import RequestDetailClient from "@/components/RequestDetailClient";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const [req, settings] = await Promise.all([
    prisma.signatureRequest.findUnique({
      where: { id },
      include: {
        signers: { orderBy: { orderIndex: "asc" } },
        auditEvents: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.companySettings.findUnique({ where: { id: "default" } }),
  ]);

  if (!req) {
    notFound();
  }

  return (
    <AppShell user={user}>
      <RequestDetailClient
        publicBaseUrl={user.activeOrg?.publicBaseUrl || settings?.publicBaseUrl || ""}
        request={{
          id: req.id,
          title: req.title,
          projectName: req.projectName,
          category: req.category,
          message: req.message,
          status: req.status,
          signingOrder: req.signingOrder,
          originalHash: req.originalHash,
          signedHash: req.signedHash,
          hasSignedPdf: Boolean(req.signedPdfPath),
          createdAt: req.createdAt.toISOString(),
          completedAt: req.completedAt ? req.completedAt.toISOString() : null,
          signers: req.signers.map((s) => ({
            id: s.id,
            role: s.role,
            name: s.name,
            email: s.email,
            phone: s.phone,
            status: s.status,
            token: s.token,
            viewedAt: s.viewedAt ? s.viewedAt.toISOString() : null,
            signedAt: s.signedAt ? s.signedAt.toISOString() : null,
            ipAddress: s.ipAddress,
          })),
          auditEvents: req.auditEvents.map((e) => ({
            id: e.id,
            action: e.action,
            details: e.details,
            ipAddress: e.ipAddress,
            createdAt: e.createdAt.toISOString(),
          })),
        }}
      />
    </AppShell>
  );
}

