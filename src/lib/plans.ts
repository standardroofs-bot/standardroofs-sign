export type PlanTier = "FREE" | "PRO" | "ENTERPRISE";

export interface PlanConfig {
  id: PlanTier;
  name: string;
  badge: string;
  monthlyDocLimit: number; // 10 for FREE, -1 for unlimited
  storageLimitBytes: bigint;
  storageLabel: string;
  priceInr: number;
  priceLabel: string;
  features: string[];
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Starter Free",
    badge: "Free Forever",
    monthlyDocLimit: 10,
    storageLimitBytes: BigInt(1024 * 1024 * 1024), // 1 GB
    storageLabel: "1 GB",
    priceInr: 0,
    priceLabel: "₹0 / month",
    features: [
      "10 Documents / month limit",
      "1 GB Cloud Drive Storage",
      "Sign-on-Selfie & GPS Verification",
      "WhatsApp & SMS 1-Click Delivery",
      "Standard PDF Download & Audit Certificate",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Business Pro",
    badge: "Most Popular",
    monthlyDocLimit: -1, // Unlimited
    storageLimitBytes: BigInt(100) * BigInt(1024 * 1024 * 1024), // 100 GB
    storageLabel: "100 GB",
    priceInr: 1499,
    priceLabel: "₹1,499 / month",
    features: [
      "Unlimited Documents & Signatures",
      "100 GB Cloud Drive Storage",
      "Sign-on-Selfie + GPS Proof Stamping",
      "Full In-Browser PDF Editor & Merger",
      "Team Roles & Multi-User Access",
      "Custom Organization Branding",
    ],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise 1 TB",
    badge: "Scale & Volume",
    monthlyDocLimit: -1, // Unlimited
    storageLimitBytes: BigInt(1024) * BigInt(1024 * 1024 * 1024), // 1099511627776 bytes (1 TB)
    storageLabel: "1 TB",
    priceInr: 4999,
    priceLabel: "₹4,999 / month",
    features: [
      "Unlimited Documents & Signatures",
      "1 TB (1,024 GB) Enterprise Drive",
      "Custom SMTP & Custom Email Branding",
      "Dedicated REST API & Webhooks",
      "Audit Trail Retention Guarantee",
      "24/7 Priority SLA Support",
    ],
  },
};

export function getPlanConfig(tier: string | null | undefined): PlanConfig {
  const normalized = (tier || "FREE").toUpperCase();
  if (normalized === "PRO" || normalized === "PRO_100GB") return PLANS.PRO;
  if (normalized === "ENTERPRISE" || normalized === "ENTERPRISE_1TB") return PLANS.ENTERPRISE;
  return PLANS.FREE;
}

export function isPlanEligibleForEditor(tier: string | null | undefined): boolean {
  const plan = getPlanConfig(tier);
  return plan.id === "PRO" || plan.id === "ENTERPRISE";
}

export function hasExceededMonthlyDocLimit(
  planTier: string,
  docsSentThisMonth: number
): boolean {
  const plan = getPlanConfig(planTier);
  if (plan.monthlyDocLimit === -1) return false;
  return docsSentThisMonth >= plan.monthlyDocLimit;
}

export function hasExceededStorageLimit(
  storageUsedBytes: bigint | number,
  additionalBytes: bigint | number,
  storageLimitBytes: bigint | number
): boolean {
  const used = BigInt(storageUsedBytes);
  const add = BigInt(additionalBytes);
  const limit = BigInt(storageLimitBytes);
  return used + add > limit;
}

