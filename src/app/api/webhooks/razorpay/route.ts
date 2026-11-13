import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PLANS, type PlanTier } from "@/lib/plans";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn("RAZORPAY_WEBHOOK_SECRET is not set in environment.");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
    }

    // Verify HMAC SHA-256 signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("Razorpay webhook signature verification failed.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const event = String(payload.event || "");

    if (
      event === "payment.captured" ||
      event === "order.paid" ||
      event === "subscription.charged"
    ) {
      const entity =
        payload.payload?.payment?.entity ||
        payload.payload?.order?.entity ||
        payload.payload?.subscription?.entity;

      const notes = entity?.notes || {};
      const orgId = notes.organizationId;
      const targetTier = (notes.planTier || "PRO").toUpperCase() as PlanTier;
      const plan = PLANS[targetTier] || PLANS.PRO;

      if (orgId) {
        const resetDate = new Date();
        resetDate.setMonth(resetDate.getMonth() + 1);

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            planTier: plan.id,
            storageLimitBytes: plan.storageLimitBytes,
            monthlyDocLimit: plan.monthlyDocLimit,
            billingCycleResetAt: resetDate,
            plan: plan.id === "ENTERPRISE" ? "ENTERPRISE_1TB" : "PRO_100GB",
            storageQuotaBytes: plan.storageLimitBytes,
            razorpayCustomerId: entity.customer_id || undefined,
            razorpaySubscriptionId: entity.subscription_id || undefined,
          },
        });

        console.log(`Successfully upgraded Org ${orgId} to ${plan.name} via Razorpay event: ${event}`);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Razorpay webhook handler error:", err);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
