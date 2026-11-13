import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const STORAGE_ROOT = path.resolve(
  process.cwd(),
  process.env.STORAGE_DIR || "./storage"
);

export function getStorageRoot(): string {
  return STORAGE_ROOT;
}

export async function ensureStorageDirs() {
  await fs.mkdir(path.join(STORAGE_ROOT, "uploads"), { recursive: true });
  await fs.mkdir(path.join(STORAGE_ROOT, "signed"), { recursive: true });
}

export function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function generateSecureToken(bytes = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const buf = crypto.randomBytes(bytes + 4);
  let out = "sr";
  for (let i = 0; i < 8; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}

function resolveSafeStoragePath(relativePath: string): string {
  const cleanRel = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(STORAGE_ROOT, cleanRel);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep) && resolved !== STORAGE_ROOT) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

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

export async function savePdfBuffer(
  subdir: "uploads" | "signed",
  filenamePrefix: string,
  buffer: Buffer
): Promise<{ relativePath: string; hash: string; sizeBytes: number }> {
  await ensureStorageDirs();
  const safePrefix = filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  const fileName = `${safePrefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.pdf`;
  const relativePath = `${subdir}/${fileName}`;
  const fullPath = resolveSafeStoragePath(relativePath);
  await fs.writeFile(fullPath, buffer);
  return {
    relativePath,
    hash: sha256Buffer(buffer),
    sizeBytes: buffer.length,
  };
}

export async function readPdfBuffer(relativePath: string): Promise<Buffer> {
  const fullPath = resolveSafeStoragePath(relativePath);
  return fs.readFile(fullPath);
}

