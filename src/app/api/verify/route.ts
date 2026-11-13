import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256Buffer } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let hashToFind = "";
    let idToFind = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        const buf = Buffer.from(await file.arrayBuffer());
        hashToFind = sha256Buffer(buf);
      }
      idToFind = String(formData.get("requestId") || "").trim();
    } else {
      const body = await req.json();
      hashToFind = String(body.hash || "").trim();
      idToFind = String(body.requestId || "").trim();
    }

    if (!hashToFind && !idToFind) {
      return NextResponse.json(
        { error: "Provide a signed PDF file, SHA-256 hash, or Request ID." },
        { status: 400 }
      );
    }

    const match = await prisma.signatureRequest.findFirst({
      where: {
        OR: [
          ...(hashToFind
            ? [{ signedHash: hashToFind }, { originalHash: hashToFind }]
            : []),
          ...(idToFind ? [{ id: idToFind }] : []),
        ],
      },
      include: {
        signers: {
          orderBy: { orderIndex: "asc" },
          select: { role: true, name: true, email: true, status: true, signedAt: true },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ verified: false, hash: hashToFind });
    }

    return NextResponse.json({
      verified: true,
      hash: hashToFind || match.signedHash || match.originalHash,
      matchType:
        hashToFind && match.signedHash === hashToFind
          ? "FINAL_SIGNED_PDF"
          : hashToFind && match.originalHash === hashToFind
          ? "ORIGINAL_PDF"
          : "REQUEST_ID",
      request: {
        id: match.id,
        title: match.title,
        projectName: match.projectName,
        category: match.category,
        status: match.status,
        completedAt: match.completedAt,
        originalHash: match.originalHash,
        signedHash: match.signedHash,
        signers: match.signers,
      },
    });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}

