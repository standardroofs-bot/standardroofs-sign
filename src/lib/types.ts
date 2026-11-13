export type FieldType =
  | "signature"
  | "initials"
  | "stamp"
  | "name"
  | "date"
  | "text"
  | "checkbox";

export type DocumentCategory =
  | "QUOTATION_BOQ"
  | "FABRICATION_DRAWING"
  | "WORK_ORDER"
  | "HANDOVER_CERTIFICATE"
  | "HR_EMPLOYEE"
  | "GENERAL";

export interface SignerRole {
  name: string;
  color: string;
}

export interface DocumentField {
  id: string;
  role: string;
  type: FieldType;
  label: string;
  page: number; // 1-based page index
  x: number; // normalized 0..1 from left
  y: number; // normalized 0..1 from top
  width: number; // normalized 0..1
  height: number; // normalized 0..1
  required: boolean;
}

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  QUOTATION_BOQ: "Quotation / BOQ",
  FABRICATION_DRAWING: "Fabrication Drawing",
  WORK_ORDER: "Work Order / Subcontractor",
  HANDOVER_CERTIFICATE: "Site Handover & Warranty",
  HR_EMPLOYEE: "HR & Employee Policy",
  GENERAL: "General Document",
};

export const ROLE_COLORS = [
  "#991B1B", // Standard Roofs Crimson
  "#0F766E", // Teal
  "#1D4ED8", // Cobalt
  "#B45309", // Amber
];

export const DRIVE_PLANS = {
  STARTER_10GB: {
    id: "STARTER_10GB",
    label: "Starter — 10 GB Drive",
    quotaBytes: BigInt(10) * BigInt(1024 * 1024 * 1024),
    priceLabel: "Free",
  },
  PRO_100GB: {
    id: "PRO_100GB",
    label: "Business — 100 GB Drive",
    quotaBytes: BigInt(100) * BigInt(1024 * 1024 * 1024),
    priceLabel: "₹1,499 / mo",
  },
  ENTERPRISE_1TB: {
    id: "ENTERPRISE_1TB",
    label: "Enterprise — 1 TB Drive",
    quotaBytes: BigInt(1024) * BigInt(1024 * 1024 * 1024),
    priceLabel: "₹4,999 / mo",
  },
} as const;

export function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i >= 2 ? 2 : 0)} ${units[i]}`;
}

export const FIELD_TYPE_META: Record<
  FieldType,
  { label: string; defaultWidth: number; defaultHeight: number }
> = {
  signature: { label: "Signature", defaultWidth: 0.22, defaultHeight: 0.065 },
  initials: { label: "Initials", defaultWidth: 0.11, defaultHeight: 0.045 },
  stamp: { label: "Company Stamp", defaultWidth: 0.16, defaultHeight: 0.075 },
  name: { label: "Full Name", defaultWidth: 0.22, defaultHeight: 0.03 },
  date: { label: "Date", defaultWidth: 0.14, defaultHeight: 0.03 },
  text: { label: "Text", defaultWidth: 0.22, defaultHeight: 0.03 },
  checkbox: { label: "Checkbox", defaultWidth: 0.03, defaultHeight: 0.025 },
};

