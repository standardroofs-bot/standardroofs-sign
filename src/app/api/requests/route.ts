import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateSecureToken, readPdfBuffer, savePdfBuffer } from "@/lib/storage";
import { dispatchInvite } from "@/lib/dispatch";
import type { DocumentField } from "@/lib/types";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  const requests = await prisma.signatureRequest.findMany({
    where: {
      organizationId: user.activeOrg.id,
      ...(status && status !== "ALL" ? { status } : {}),
      ...(category && category !== "ALL" ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      signers: { orderBy: { orderIndex: "asc" } },
      template: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ requests });
}

interface IncomingSigner {
  role: string;
  name: string;
  email?: string;
  phone?: string;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const templateId = body.templateId ? String(body.templateId) : null;
    if (!templateId) {
      return NextResponse.json(
        { error: "Please select a template." },
        { status: 400 }
      );
    }

    const template = await prisma.template.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.activeOrg.id },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    const mode = body.mode === "BULK" ? "BULK" : "SINGLE";
    const requestsToCreateCount = mode === "BULK" && Array.isArray(body.bulkRecipients)
      ? Math.max(1, body.bulkRecipients.length)
      : 1;

    // Check & Enforce Monthly Document Limits (Free Tier = 10 docs/mo)
    const now = new Date();
    let currentDocsSent = org.docsSentThisMonth ?? 0;
    if (org.billingCycleResetAt && now > org.billingCycleResetAt) {
      currentDocsSent = 0;
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      await prisma.organization.update({
        where: { id: org.id },
        data: { docsSentThisMonth: 0, billingCycleResetAt: nextMonth },
      });
    }

    const monthlyCap = org.monthlyDocLimit ?? 10;
    if (monthlyCap !== -1 && currentDocsSent + requestsToCreateCount > monthlyCap) {
      return NextResponse.json(
        {
          error: `Monthly limit reached (${currentDocsSent}/${monthlyCap} documents used). Upgrade to Business Pro for unlimited documents.`,
          code: "DOC_LIMIT_EXCEEDED",
        },
        { status: 403 }
      );
    }

    // Check & Enforce Storage Quotas
    const storageUsed = org.storageUsedBytes ?? BigInt(0);
    const storageLimit = org.storageLimitBytes ?? org.storageQuotaBytes ?? BigInt(1073741824);
    const estimatedNewBytes = BigInt(template.fileSizeBytes || 50000) * BigInt(requestsToCreateCount);
    if (storageUsed + estimatedNewBytes > storageLimit) {
      return NextResponse.json(
        {
          error: "Cloud Drive storage quota exceeded. Upgrade your plan to send additional documents.",
          code: "STORAGE_LIMIT_EXCEEDED",
        },
        { status: 403 }
      );
    }

    const title = String(body.title || template.name).trim();
    const projectName = String(body.projectName || "").trim();
    const category = String(body.category || template.category || "GENERAL");
    const message = String(body.message || "").trim();
    const signingOrder =
      body.signingOrder === "PARALLEL" ? "PARALLEL" : "SEQUENTIAL";
    const channels: string[] = Array.isArray(body.channels) && body.channels.length > 0
      ? body.channels.map(String)
      : ["WHATSAPP", "EMAIL", "SMS"];

    const settings = await prisma.companySettings.findUnique({
      where: { id: "default" },
    });

    const requirePhotoLocation =
      body.requirePhotoLocation !== undefined
        ? Boolean(body.requirePhotoLocation)
        : template.requirePhotoLocation;

    const rawBaseUrl =
      user.activeOrg.publicBaseUrl?.trim() ||
      settings?.publicBaseUrl?.trim() ||
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3030";
    const baseUrl = rawBaseUrl.replace(/\/+$/, "");

    const originalBuffer = await readPdfBuffer(template.pdfPath);
    const fields = JSON.parse(template.fieldsJson || "[]") as DocumentField[];

    const createdRequests = [];

    if (mode === "BULK") {
      const bulkRecipients = Array.isArray(body.bulkRecipients)
        ? (body.bulkRecipients as IncomingSigner[])
        : [];
      if (bulkRecipients.length === 0) {
        return NextResponse.json(
          { error: "Add at least one recipient for Bulk Send." },
          { status: 400 }
        );
      }

      const defaultRole =
        fields[0]?.role ||
        (JSON.parse(template.rolesJson || "[]")[0]?.name as string) ||
        "Client";

      for (const r of bulkRecipients) {
        const cleanName = String(r.name || "").trim();
        const cleanEmail = String(r.email || "").trim().toLowerCase();
        const cleanPhone = String(r.phone || "").trim();
        if (!cleanName || (!cleanEmail && !cleanPhone)) continue;

        const copiedPdf = await savePdfBuffer("uploads", title, originalBuffer);
        const token = generateSecureToken();
        const docTitle = `${title} — ${cleanName}`;

        const created = await prisma.signatureRequest.create({
          data: {
            organizationId: user.activeOrg.id,
            title: docTitle,
            projectName,
            category,
            message,
            status: "PENDING",
            signingOrder: "SEQUENTIAL",
            requirePhotoLocation,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            originalPdfPath: copiedPdf.relativePath,
            fileSizeBytes: copiedPdf.sizeBytes,
            originalHash: copiedPdf.hash,
            fieldsJson: JSON.stringify(fields),
            templateId: template.id,
            createdById: user.id,
            signers: {
              create: [
                {
                  role: r.role || defaultRole,
                  name: cleanName,
                  email: cleanEmail,
                  phone: cleanPhone,
                  channels: channels.join(","),
                  orderIndex: 0,
                  token,
                  status: "PENDING",
                },
              ],
            },
            auditEvents: {
              create: {
                action: "CREATED",
                details: `Bulk request sent to ${cleanName} by ${user.name}`,
                seenByAdmin: true,
              },
            },
          },
          include: { signers: true },
        });

        const signer = created.signers[0];
        const signUrl = `${baseUrl}/s/${signer.token}`;
        const dispatch = await dispatchInvite({
          signerId: signer.id,
          requestId: created.id,
          name: signer.name,
          email: signer.email,
          phone: signer.phone,
          channels,
          documentTitle: created.title,
          projectName: created.projectName,
          message: created.message,
          signUrl,
        });

        createdRequests.push({
          request: created,
          signUrl,
          dispatch,
        });
      }

      if (createdRequests.length === 0) {
        return NextResponse.json(
          { error: "Each recipient needs a Name and either Email or Phone." },
          { status: 400 }
        );
      }

      // Update Organization quota tracking
      const totalBytes = createdRequests.reduce((acc, curr) => acc + (curr.request.fileSizeBytes || 0), 0);
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          docsSentThisMonth: { increment: createdRequests.length },
          storageUsedBytes: { increment: totalBytes },
        },
      });

      return NextResponse.json(
        {
          mode: "BULK",
          count: createdRequests.length,
          request: createdRequests[0].request,
          items: createdRequests,
        },
        { status: 201 }
      );
    }

    // SINGLE / MULTI-PARTY MODE
    const signersInput = Array.isArray(body.signers)
      ? (body.signers as IncomingSigner[])
      : [];
    if (signersInput.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required." },
        { status: 400 }
      );
    }

    for (const s of signersInput) {
      if (!String(s.name || "").trim() || (!String(s.email || "").trim() && !String(s.phone || "").trim())) {
        return NextResponse.json(
          { error: `Enter Name and Email or Phone for ${s.role || "Recipient"}.` },
          { status: 400 }
        );
      }
    }

    const copiedPdf = await savePdfBuffer("uploads", title, originalBuffer);

    const created = await prisma.signatureRequest.create({
      data: {
        organizationId: user.activeOrg.id,
        title,
        projectName,
        category,
        message,
        status: "PENDING",
        signingOrder,
        requirePhotoLocation,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        originalPdfPath: copiedPdf.relativePath,
        fileSizeBytes: copiedPdf.sizeBytes,
        originalHash: copiedPdf.hash,
        fieldsJson: JSON.stringify(fields),
        templateId: template.id,
        createdById: user.id,
        signers: {
          create: signersInput.map((s, idx) => ({
            role: String(s.role || "Client"),
            name: String(s.name || "").trim(),
            email: String(s.email || "").trim().toLowerCase(),
            phone: String(s.phone || "").trim(),
            channels: channels.join(","),
            orderIndex: idx,
            token: generateSecureToken(),
            status:
              signingOrder === "SEQUENTIAL" && idx > 0 ? "WAITING" : "PENDING",
          })),
        },
        auditEvents: {
          create: {
            action: "CREATED",
            details: `Sent "${title}" to ${signersInput.map((s) => s.name).join(", ")}`,
            seenByAdmin: true,
          },
        },
      },
      include: { signers: { orderBy: { orderIndex: "asc" } } },
    });

    const dispatchResults = [];
    for (const signer of created.signers) {
      if (signer.status !== "PENDING") continue;
      const signUrl = `${baseUrl}/s/${signer.token}`;
      const dispatch = await dispatchInvite({
        signerId: signer.id,
        requestId: created.id,
        name: signer.name,
        email: signer.email,
        phone: signer.phone,
        channels,
        documentTitle: created.title,
        projectName: created.projectName,
        message: created.message,
        signUrl,
      });

      if (dispatch.email.sent || dispatch.whatsapp.autoSent || dispatch.sms.autoSent) {
        await prisma.auditEvent.create({
          data: {
            requestId: created.id,
            signerId: signer.id,
            action: "SENT",
            details: `Dispatched to ${signer.name} (${[
              dispatch.email.sent ? "Email" : null,
              dispatch.whatsapp.autoSent ? "WhatsApp" : null,
              dispatch.sms.autoSent ? "SMS" : null,
            ]
              .filter(Boolean)
              .join(", ")})`,
            seenByAdmin: true,
          },
        });
      }

      dispatchResults.push({
        signerId: signer.id,
        name: signer.name,
        signUrl,
        dispatch,
      });
    }

    // Update Organization quota tracking
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        docsSentThisMonth: { increment: 1 },
        storageUsedBytes: { increment: created.fileSizeBytes || 0 },
      },
    });

    return NextResponse.json(
      { mode: "SINGLE", request: created, dispatchResults },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create request error:", err);
    return NextResponse.json(
      { error: "Failed to create signature request." },
      { status: 500 }
    );
  }
}
