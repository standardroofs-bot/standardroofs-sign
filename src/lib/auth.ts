import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "sr_sign_session";
const SECRET = process.env.APP_SECRET || "standardroofs-sign-dev-secret-change-me";

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(base64, "base64").toString("utf8");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = base64UrlEncode(JSON.stringify(fullPayload));
  const sig = base64UrlEncode(
    crypto.createHmac("sha256", SECRET).update(data).digest()
  );
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expectedSig = base64UrlEncode(
      crypto.createHmac("sha256", SECRET).update(data).digest()
    );
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
    const parsed = JSON.parse(base64UrlDecode(data)) as SessionPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      activeOrgId: true,
      memberships: {
        include: {
          organization: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) return null;

  const activeMembership =
    user.memberships.find((m) => m.organizationId === user.activeOrgId) ||
    user.memberships[0] ||
    null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    activeOrg: activeMembership ? activeMembership.organization : null,
    activeOrgRole: activeMembership ? activeMembership.role : "MEMBER",
    organizations: user.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      plan: m.organization.plan,
      role: m.role,
    })),
  };
}

