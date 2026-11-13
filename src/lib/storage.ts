import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const STORAGE_ROOT = path.resolve(
  process.cwd(),
  process.env.STORAGE_DIR || "./storage"
);

export function getStorageRoot(): string {
  return STORAGE_ROOT;
}

export async function ensureStorageDirs() {
  try {
    await fs.mkdir(path.join(STORAGE_ROOT, "uploads"), { recursive: true });
    await fs.mkdir(path.join(STORAGE_ROOT, "signed"), { recursive: true });
  } catch {
    // Ignore error if directory already exists
  }
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

// -----------------------------------------------------------------------------
// Cloudflare R2 / AWS S3 Client Initialization
// -----------------------------------------------------------------------------
const isR2Configured = Boolean(
  process.env.STORAGE_DRIVER === "r2" ||
  (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)
);

let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!isR2Configured) return null;
  if (!s3ClientInstance) {
    const accountId = process.env.R2_ACCOUNT_ID || "";
    const endpoint =
      process.env.R2_ENDPOINT ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return s3ClientInstance;
}

export function isCloudflareR2Active(): boolean {
  return isR2Configured;
}

// -----------------------------------------------------------------------------
// Core Save & Read Operations with Seamless Fallback
// -----------------------------------------------------------------------------
export async function savePdfBuffer(
  subdir: "uploads" | "signed",
  filenamePrefix: string,
  buffer: Buffer
): Promise<{ relativePath: string; hash: string; sizeBytes: number }> {
  const safePrefix = filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  const fileName = `${safePrefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.pdf`;
  const relativePath = `${subdir}/${fileName}`;
  const hash = sha256Buffer(buffer);
  const sizeBytes = buffer.length;

  const s3 = getS3Client();
  const bucket = process.env.R2_BUCKET_NAME || "standard-esign-documents";

  if (s3 && process.env.STORAGE_DRIVER === "r2") {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: relativePath,
          Body: buffer,
          ContentType: "application/pdf",
          Metadata: {
            sha256: hash,
            uploadedAt: new Date().toISOString(),
          },
        })
      );
      return { relativePath, hash, sizeBytes };
    } catch (err) {
      console.error("Cloudflare R2 PutObject failed, falling back to local storage:", err);
    }
  }

  // Fallback / Default: Local Disk Storage
  await ensureStorageDirs();
  const fullPath = resolveSafeStoragePath(relativePath);
  await fs.writeFile(fullPath, buffer);

  return {
    relativePath,
    hash,
    sizeBytes,
  };
}

export async function readPdfBuffer(relativePath: string): Promise<Buffer> {
  const s3 = getS3Client();
  const bucket = process.env.R2_BUCKET_NAME || "standard-esign-documents";

  if (s3 && process.env.STORAGE_DRIVER === "r2") {
    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: relativePath,
        })
      );
      if (response.Body) {
        const bytes = await response.Body.transformToByteArray();
        return Buffer.from(bytes);
      }
    } catch (err) {
      console.warn("Could not read from Cloudflare R2, falling back to local file:", err);
    }
  }

  // Fallback / Default: Local File
  const fullPath = resolveSafeStoragePath(relativePath);
  return fs.readFile(fullPath);
}

export async function deletePdfBuffer(relativePath: string): Promise<void> {
  const s3 = getS3Client();
  const bucket = process.env.R2_BUCKET_NAME || "standard-esign-documents";

  if (s3 && process.env.STORAGE_DRIVER === "r2") {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: relativePath,
        })
      );
    } catch {
      // Ignore deletion errors on remote
    }
  }

  try {
    const fullPath = resolveSafeStoragePath(relativePath);
    await fs.unlink(fullPath);
  } catch {
    // Ignore local file unlink error if file doesn't exist
  }
}
