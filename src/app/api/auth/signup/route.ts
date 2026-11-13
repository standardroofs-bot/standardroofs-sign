import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { DRIVE_PLANS } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName = String(body.companyName || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const phone = String(body.phone || "").trim();

    if (!companyName || !name || !email || password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Organization Name, Your Name, Email, and Password (min 6 chars) are required.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const baseSlug =
      companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) || "org";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const passwordHash = await bcrypt.hash(password, 10);

    const org = await prisma.organization.create({
      data: {
        name: companyName,
        slug,
        email,
        phone,
        plan: "STARTER_10GB",
        storageQuotaBytes: DRIVE_PLANS.STARTER_10GB.quotaBytes,
      },
    });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        title: "Account Owner",
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
        organization: { id: org.id, name: org.name, slug: org.slug },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Failed to create organization account." },
      { status: 500 }
    );
  }
}

