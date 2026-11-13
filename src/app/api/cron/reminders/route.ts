import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchInvite } from "@/lib/dispatch";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const cronSecret = process.env.CRON_SECRET || "standard-esign-cron-secret-2026";

    // Verify Bearer token or ?secret= query param
    const token = authHeader?.replace(/^Bearer\s+/i, "") || searchParams.get("secret");
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized: Invalid CRON_SECRET" }, { status: 401 });
    }

    const now = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Mark Expired Requests
    const expiredRequests = await prisma.signatureRequest.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        expiresAt: { lt: now },
      },
      select: { id: true, title: true },
    });

    for (const exp of expiredRequests) {
      await prisma.signatureRequest.update({
        where: { id: exp.id },
        data: { status: "VOIDED" },
      });
      await prisma.auditEvent.create({
        data: {
          requestId: exp.id,
          action: "VOIDED",
          details: `Document automatically expired after deadline.`,
          seenByAdmin: false,
        },
      });
    }

    // 2. Identify Pending Requests Needing 24-Hour Reminders
    const requestsNeedingReminder = await prisma.signatureRequest.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        createdAt: { lt: oneDayAgo },
        OR: [
          { lastReminderAt: null },
          { lastReminderAt: { lt: oneDayAgo } },
        ],
      },
      include: {
        organization: true,
        signers: {
          where: { status: { in: ["PENDING", "VIEWED"] } },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    let remindersSentCount = 0;
    const settings = await prisma.companySettings.findUnique({ where: { id: "default" } });

    for (const reqItem of requestsNeedingReminder) {
      const rawBase =
        reqItem.organization?.publicBaseUrl ||
        settings?.publicBaseUrl ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3030";
      const baseUrl = rawBase.replace(/\/+$/, "");

      for (const signer of reqItem.signers) {
        const signUrl = `${baseUrl}/s/${signer.token}`;
        const channels = signer.channels.split(",");

        await dispatchInvite({
          signerId: signer.id,
          requestId: reqItem.id,
          name: signer.name,
          email: signer.email,
          phone: signer.phone,
          channels,
          documentTitle: reqItem.title,
          projectName: reqItem.projectName,
          message: "Reminder: You have a pending document waiting for your electronic signature.",
          signUrl,
        });

        await prisma.auditEvent.create({
          data: {
            requestId: reqItem.id,
            signerId: signer.id,
            action: "SENT",
            details: `Automated 24h reminder dispatched to ${signer.name}`,
            seenByAdmin: false,
          },
        });

        remindersSentCount++;
      }

      await prisma.signatureRequest.update({
        where: { id: reqItem.id },
        data: { lastReminderAt: now },
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      expiredCount: expiredRequests.length,
      remindersSentCount,
    });
  } catch (err) {
    console.error("Cron reminders error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Allow GET for easy cron job testing via monitoring tools
export async function GET(req: Request) {
  return POST(req);
}

