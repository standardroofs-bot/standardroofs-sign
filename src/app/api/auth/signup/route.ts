import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accountType = body.accountType === "INDIVIDUAL" ? "INDIVIDUAL" : "BUSINESS";
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const phone = String(body.phone || "").trim();
    const gstin = String(body.gstin || "").trim();

    let companyName = String(body.companyName || "").trim();
    if (accountType === "INDIVIDUAL") {
      companyName = `${name || "Personal"} (Workspace)`;
    }

    if (!name || !email || password.length < 6) {
      return NextResponse.json(
        { error: "Your Name, Email, and Password (min 6 chars) are required." },
        { status: 400 }
      );
    }

    if (accountType === "BUSINESS" && !companyName) {
      return NextResponse.json(
        { error: "Business / Company Name is required for organization accounts." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please Sign In." },
        { status: 409 }
      );
    }

    const baseSlug =
      companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) || "workspace";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const passwordHash = await bcrypt.hash(password, 10);
    const freePlan = PLANS.FREE;

    // Reset date 1 month from now
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);

    const org = await prisma.organization.create({
      data: {
        name: companyName,
        slug,
        email,
        phone,
        accountType,
        gstin,
        planTier: freePlan.id,
        storageLimitBytes: freePlan.storageLimitBytes,
        monthlyDocLimit: freePlan.monthlyDocLimit,
        docsSentThisMonth: 0,
        billingCycleResetAt: resetDate,
        plan: "STARTER_10GB",
        storageQuotaBytes: freePlan.storageLimitBytes,
      },
    });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        title: accountType === "INDIVIDUAL" ? "Individual" : "Owner / MD",
        activeOrgId: org.id,
        memberships: {
          create: {
            organizationId: org.id,
            role: "OWNER",
          },
        },
      },
    });

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    await setSessionCookie(token);

    return NextResponse.json(
      {
        user: { id: user.id, name: user.name, email: user.email },
        organization: { id: org.id, name: org.name, slug: org.slug, planTier: org.planTier },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Failed to create account workspace." },
      { status: 500 }
    );
  }
}
