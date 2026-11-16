import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readPdfBuffer, savePdfBuffer } from "@/lib/storage";
import { applySignaturesAndFinalizePdf } from "@/lib/pdf";
import { dispatchInvite, sendCompletedCopiesEmail } from "@/lib/dispatch";
import { reverseGeocode } from "@/lib/geocode";
import { CATEGORY_LABELS, type DocumentCategory, type DocumentField } from "@/lib/types";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const signer = await prisma.signer.findUnique({
    where: { token },
    include: {
      request: {
        include: {
          organization: true,
          signers: {
            orderBy: { orderIndex: "asc" },
            select: { id: true, role: true, name: true, status: true, signedAt: true },
          },
        },
      },
    },
  });

  if (!signer) {
    return NextResponse.json({ error: "Invalid or expired signing link." }, { status: 404 });
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });

  if (signer.status === "PENDING" && signer.request.status !== "VOIDED") {
    const ip = getClientIp(req);
    const ua = req.headers.get("user-agent") || "";
    await prisma.signer.update({
      where: { id: signer.id },
      data: { status: "VIEWED", viewedAt: new Date(), ipAddress: ip, userAgent: ua },
    });
    await prisma.auditEvent.create({
      data: {
        requestId: signer.requestId,
        signerId: signer.id,
        action: "VIEWED",
        details: `${signer.name} (${signer.role}) opened the document`,
        ipAddress: ip,
        userAgent: ua,
      },
    });
    signer.status = "VIEWED";
  }

  const fields = JSON.parse(signer.request.fieldsJson || "[]") as DocumentField[];
  const actualPasscode = signer.accessPasscode || signer.request.accessPasscode;
  const requiresPasscode = Boolean(actualPasscode);
  const isPasscodeVerified = Boolean(signer.passcodeVerifiedAt) || signer.status === "SIGNED";
  const requiredAttachments = JSON.parse(signer.request.requiredAttachmentsJson || "[]");
  const attachments = JSON.parse(signer.attachmentsJson || "[]");

  return NextResponse.json({
    company: {
      name: signer.request.organization?.name || settings?.companyName || "Standard e-Sign",
      tagline: signer.request.organization?.tagline || settings?.tagline || "Electronic Signature & Verification",
      website: signer.request.organization?.website || settings?.website || "",
      phone: signer.request.organization?.phone || settings?.phone || "",
    },
    signer: {
      id: signer.id,
      role: signer.role,
      name: signer.name,
      email: signer.email,
      status: signer.status,
      signedAt: signer.signedAt,
      passcodeVerified: isPasscodeVerified,
    },
    request: {
      id: signer.request.id,
      title: signer.request.title,
      projectName: signer.request.projectName,
      category: signer.request.category,
      message: signer.request.message,
      status: signer.request.status,
      requirePhotoLocation: signer.request.requirePhotoLocation,
      isConfidential: signer.request.isConfidential,
      requiresPasscode,
      isPasscodeVerified,
      requiredAttachments,
      attachments,
      signedHash: signer.request.signedHash,
      hasSignedPdf: Boolean(signer.request.signedPdfPath),
      signers: signer.request.signers,
      fields: requiresPasscode && !isPasscodeVerified ? [] : fields,
    },
  });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const signer = await prisma.signer.findUnique({
    where: { token },
    include: {
      request: {
        include: {
          organization: true,
          signers: { orderBy: { orderIndex: "asc" } },
        },
      },
    },
  });

  if (!signer) {
    return NextResponse.json({ error: "Invalid signing link." }, { status: 404 });
  }

  if (signer.request.status === "VOIDED") {
    return NextResponse.json({ error: "This request has been voided." }, { status: 400 });
  }

  if (signer.status === "WAITING") {
    return NextResponse.json(
      { error: "Waiting for an earlier signer to complete first." },
      { status: 400 }
    );
  }

  if (signer.status === "SIGNED") {
    return NextResponse.json(
      { error: "You have already signed this document." },
      { status: 400 }
    );
  }

  const body = await req.json();

  // Action: Verify Access Passcode / PIN for confidential documents
  if (body.action === "VERIFY_PASSCODE") {
    const entered = String(body.passcode || "").trim();
    const actual = String(signer.accessPasscode || signer.request.accessPasscode || "").trim();
    if (!actual || entered.toLowerCase() === actual.toLowerCase()) {
      await prisma.signer.update({
        where: { id: signer.id },
        data: { passcodeVerifiedAt: new Date() },
      });
      const ip = getClientIp(req);
      const ua = req.headers.get("user-agent") || "";
      await prisma.auditEvent.create({
        data: {
          requestId: signer.requestId,
          signerId: signer.id,
          action: "VIEWED",
          details: `${signer.name} (${signer.role}) unlocked confidential document with verified access PIN`,
          ipAddress: ip,
          userAgent: ua,
        },
      });
      return NextResponse.json({ success: true, verified: true });
    } else {
      return NextResponse.json(
        { error: "Incorrect Access PIN. Please verify with the sender." },
        { status: 400 }
      );
    }
  }

  // Security Gate: Ensure passcode was verified before allowing final signature
  const actualPasscode = signer.accessPasscode || signer.request.accessPasscode;
  if (actualPasscode && !signer.passcodeVerifiedAt) {
    return NextResponse.json(
      { error: "Confidential document requires access PIN verification before signing." },
      { status: 403 }
    );
  }

  // Mandatory KYC Attachments validation
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const requiredList = JSON.parse(signer.request.requiredAttachmentsJson || "[]") as Array<{
    id: string;
    label: string;
    required: boolean;
  }>;
  for (const reqAtt of requiredList) {
    if (reqAtt.required) {
      const found = attachments.find((a: any) => a.id === reqAtt.id && Boolean(a.dataUrl));
      if (!found) {
        return NextResponse.json(
          { error: `Please upload required official attachment: ${reqAtt.label}` },
          { status: 400 }
        );
      }
    }
  }

  const fieldValues = (body.fieldValues || {}) as Record<string, string>;
  const photoDataUrl = typeof body.photoDataUrl === "string" ? body.photoDataUrl : null;
  const rawSignatureDataUrl = typeof body.rawSignatureDataUrl === "string" ? body.rawSignatureDataUrl : null;
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;
  const locationLabel = typeof body.locationLabel === "string" ? body.locationLabel.trim() : null;
  let locationAddress = typeof body.locationAddress === "string" ? body.locationAddress.trim() : null;

  // If coordinates are present but client didn't supply an address, resolve server-side
  if (!locationAddress && latitude != null && longitude != null) {
    try {
      const geo = await reverseGeocode(latitude, longitude);
      if (geo.address) locationAddress = geo.address;
    } catch {
      // ignore
    }
  }

  const allFields = JSON.parse(signer.request.fieldsJson || "[]") as DocumentField[];
  const myFields = allFields.filter((f) => f.role === signer.role);

  // If signer drew signature on selfie, auto-fill any empty signature field on document
  if (rawSignatureDataUrl) {
    for (const field of myFields) {
      if ((field.type === "signature" || field.type === "initials") && !fieldValues[field.id]) {
        fieldValues[field.id] = rawSignatureDataUrl;
      }
    }
  }

  for (const field of myFields) {
    if (field.required && !String(fieldValues[field.id] || "").trim()) {
      return NextResponse.json(
        { error: `Please complete required field: ${field.label}` },
        { status: 400 }
      );
    }
  }

  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") || "";
  const now = new Date();

  await prisma.signer.update({
    where: { id: signer.id },
    data: {
      status: "SIGNED",
      signedAt: now,
      ipAddress: ip,
      userAgent: ua,
      photoDataUrl,
      latitude,
      longitude,
      locationLabel,
      locationAddress,
      locationCapturedAt: photoDataUrl || latitude != null ? now : null,
      attachmentsJson: JSON.stringify(attachments),
      fieldValuesJson: JSON.stringify(fieldValues),
    },
  });

  await prisma.auditEvent.create({
    data: {
      requestId: signer.requestId,
      signerId: signer.id,
      action: "SIGNED",
      details: `${signer.name} (${signer.role}) signed the document`,
      ipAddress: ip,
      userAgent: ua,
    },
  });

  // Reload all signers to determine next step or finalization
  const updatedSigners = await prisma.signer.findMany({
    where: { requestId: signer.requestId },
    orderBy: { orderIndex: "asc" },
  });

  const nextWaiting = updatedSigners.find((s) => s.status === "WAITING");
  const allSigned = updatedSigners.every((s) => s.status === "SIGNED");

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });

  if (nextWaiting && signer.request.signingOrder === "SEQUENTIAL") {
    await prisma.signer.update({
      where: { id: nextWaiting.id },
      data: { status: "PENDING" },
    });
    await prisma.signatureRequest.update({
      where: { id: signer.requestId },
      data: { status: "PARTIAL" },
    });

    const rawBaseUrl =
      settings?.publicBaseUrl?.trim() ||
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3030";
    const baseUrl = rawBaseUrl.replace(/\/+$/, "");

    await dispatchInvite({
      signerId: nextWaiting.id,
      requestId: signer.requestId,
      name: nextWaiting.name,
      email: nextWaiting.email,
      phone: nextWaiting.phone,
      channels: nextWaiting.channels.split(","),
      documentTitle: signer.request.title,
      projectName: signer.request.projectName,
      message: signer.request.message,
      signUrl: `${baseUrl}/s/${nextWaiting.token}`,
    });
  } else if (!allSigned) {
    await prisma.signatureRequest.update({
      where: { id: signer.requestId },
      data: { status: "PARTIAL" },
    });
  }

  // Always generate/update the signed PDF after each signature so both parties can download immediately
  const originalBuffer = await readPdfBuffer(signer.request.originalPdfPath);
  const finalizedBuffer = await applySignaturesAndFinalizePdf({
    originalPdfBuffer: originalBuffer,
    requestId: signer.request.id,
    title: signer.request.title,
    projectName: signer.request.projectName,
    categoryLabel:
      CATEGORY_LABELS[signer.request.category as DocumentCategory] ||
      signer.request.category,
    originalHash: signer.request.originalHash,
    fields: allFields,
    signers: updatedSigners.map((s) => ({
      id: s.id,
      role: s.role,
      name: s.name,
      email: s.email,
      phone: s.phone,
      signedAt: s.signedAt,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      photoDataUrl: s.photoDataUrl,
      latitude: s.latitude,
      longitude: s.longitude,
      locationLabel: s.locationLabel,
      locationAddress: s.locationAddress,
      passcodeVerified: Boolean(s.passcodeVerifiedAt),
      attachments: JSON.parse(s.attachmentsJson || "[]"),
      fieldValues: JSON.parse(s.fieldValuesJson || "{}"),
    })),
    companyName: signer.request.organization?.name || settings?.companyName || "Standard e-Sign",
    companyWebsite: signer.request.organization?.website || settings?.website || "https://www.standardroofs.in",
    publicBaseUrl: signer.request.organization?.publicBaseUrl || settings?.publicBaseUrl || "",
  });

  const savedSigned = await savePdfBuffer(
    "signed",
    signer.request.title,
    finalizedBuffer
  );

  if (allSigned) {
    await prisma.signatureRequest.update({
      where: { id: signer.requestId },
      data: {
        status: "COMPLETED",
        signedPdfPath: savedSigned.relativePath,
        signedHash: savedSigned.hash,
        completedAt: new Date(),
      },
    });

    await prisma.auditEvent.create({
      data: {
        requestId: signer.requestId,
        action: "COMPLETED",
        details: `All parties signed. Final PDF sealed (SHA-256: ${savedSigned.hash.slice(0, 16)}...)`,
      },
    });

    await sendCompletedCopiesEmail({
      documentTitle: signer.request.title,
      projectName: signer.request.projectName || "",
      recipients: updatedSigners.map((s) => ({ name: s.name, email: s.email })),
      pdfBuffer: finalizedBuffer,
    }).catch(() => {});
  } else {
    await prisma.signatureRequest.update({
      where: { id: signer.requestId },
      data: {
        status: "PARTIAL",
        signedPdfPath: savedSigned.relativePath,
        signedHash: savedSigned.hash,
      },
    });
  }

  return NextResponse.json({ ok: true, allSigned });
}

