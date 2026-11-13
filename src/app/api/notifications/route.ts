import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !user.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await prisma.auditEvent.findMany({
    where: {
      action: { in: ["VIEWED", "SIGNED", "COMPLETED"] },
      request: { organizationId: user.activeOrg.id },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      request: { select: { id: true, title: true } },
    },
  });

  const unreadCount = events.filter((e) => !e.seenByAdmin).length;
  return NextResponse.json({ events, unreadCount });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.auditEvent.updateMany({
    where: { seenByAdmin: false },
    data: { seenByAdmin: true },
  });

  return NextResponse.json({ ok: true });
}
