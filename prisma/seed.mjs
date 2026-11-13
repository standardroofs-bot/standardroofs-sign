import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const legacy = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });

  const org = await prisma.organization.upsert({
    where: { id: "org_standard_roofs" },
    update: {},
    create: {
      id: "org_standard_roofs",
      name: legacy?.companyName || "Standard Roofs",
      slug: "standard-roofs",
      tagline: legacy?.tagline || "Document Signing & Approvals",
      website: legacy?.website || "https://www.standardroofs.in",
      email: legacy?.email || "info@standardroofs.in",
      phone: legacy?.phone || "+91-86084-75787",
      address: legacy?.address || "Erode, Tamil Nadu, India",
      accentColor: legacy?.accentColor || "#991B1B",
      publicBaseUrl: legacy?.publicBaseUrl || "",
      plan: "PRO_100GB",
      storageQuotaBytes: BigInt(100) * BigInt(1024 * 1024 * 1024),
      smtpHost: legacy?.smtpHost || "",
      smtpPort: legacy?.smtpPort || 587,
      smtpUser: legacy?.smtpUser || "",
      smtpPass: legacy?.smtpPass || "",
      smtpFrom: legacy?.smtpFrom || "Standard Roofs <info@standardroofs.in>",
      whatsappWebhookUrl: legacy?.whatsappWebhookUrl || "",
      smsWebhookUrl: legacy?.smsWebhookUrl || "",
      fast2smsApiKey: legacy?.fast2smsApiKey || "",
    },
  });

  const adminEmail = "admin@standardroofs.in";
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!admin) {
    const passwordHash = await bcrypt.hash("StandardRoofs@2026", 10);
    admin = await prisma.user.create({
      data: {
        name: "Standard Roofs Admin",
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        title: "Managing Director",
        activeOrgId: org.id,
      },
    });
    console.log("Seeded admin user:", adminEmail);
  } else if (!admin.activeOrgId) {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: { activeOrgId: org.id },
    });
  }

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: admin.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      organizationId: org.id,
      role: "OWNER",
    },
  });

  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Standard Roofs",
      tagline: "Document Signing & Approvals",
      website: "https://www.standardroofs.in",
      email: "info@standardroofs.in",
      phone: "+91-86084-75787",
      address: "Erode, Tamil Nadu, India",
      accentColor: "#991B1B",
    },
  });

  console.log("Seeded Standard Roofs organization & admin membership.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
