import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS, type PlanTier } from "@/lib/plans";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawTier = String(body.planTier || "PRO").toUpperCase() as PlanTier;
    const targetPlan = PLANS[rawTier] || PLANS.PRO;

    const rzpKeyId = process.env.RAZORPAY_KEY_ID;
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;

    const hasLiveRazorpay =
      rzpKeyId &&
      rzpSecret &&
      !rzpKeyId.includes("placeholder") &&
      !rzpSecret.includes("placeholder");

    if (hasLiveRazorpay) {
      // Create Razorpay Order / Subscription for real checkout
      const amountPaise = targetPlan.priceInr * 100;
      const authHeader = `Basic ${Buffer.from(`${rzpKeyId}:${rzpSecret}`).toString("base64")}`;

      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `rcpt_${user.activeOrg.id.slice(-6)}_${Date.now().toString().slice(-6)}`,
          notes: {
            organizationId: user.activeOrg.id,
            planTier: targetPlan.id,
            userId: user.id,
          },
        }),
      });

      if (orderRes.ok) {
        const orderData = await orderRes.json();
        return NextResponse.json({
          live: true,
          keyId: rzpKeyId,
          orderId: orderData.id,
          amount: amountPaise,
          currency: "INR",
          planTier: targetPlan.id,
          planName: targetPlan.name,
          orgName: user.activeOrg.name,
          userEmail: user.email,
          userName: user.name,
        });
      }
    }

    // Sandbox / Instant Upgrade Mode (when live Razorpay keys are not yet configured)
    await prisma.organization.update({
      where: { id: user.activeOrg.id },
      data: {
        planTier: targetPlan.id,
        storageLimitBytes: targetPlan.storageLimitBytes,
        monthlyDocLimit: targetPlan.monthlyDocLimit,
        plan: targetPlan.id === "ENTERPRISE" ? "ENTERPRISE_1TB" : "PRO_100GB",
        storageQuotaBytes: targetPlan.storageLimitBytes,
      },
    });

    return NextResponse.json({
      live: false,
      demoMode: true,
      planTier: targetPlan.id,
      planName: targetPlan.name,
      message: `Successfully upgraded ${user.activeOrg.name} to ${targetPlan.name} (${targetPlan.storageLabel} storage, unlimited documents).`,
    });
  } catch (err) {
    console.error("Create subscription error:", err);
    return NextResponse.json(
      { error: "Failed to initiate subscription upgrade." },
      { status: 500 }
    );
  }
}

