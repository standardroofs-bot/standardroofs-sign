import nodemailer from "nodemailer";
import { prisma } from "./prisma";

export interface DispatchTarget {
  signerId: string;
  requestId: string;
  name: string;
  email: string;
  phone: string;
  channels: string[]; // ["EMAIL", "WHATSAPP", "SMS"]
  documentTitle: string;
  projectName: string;
  message: string;
  signUrl: string;
}

export interface DispatchResult {
  email: { sent: boolean; reason?: string };
  whatsapp: { autoSent: boolean; deepLink: string; reason?: string };
  sms: { autoSent: boolean; deepLink: string; reason?: string };
}

export function buildShortMessage(params: {
  signerName: string;
  companyName: string;
  documentTitle: string;
  signUrl: string;
}) {
  return `Hello ${params.signerName}, ${params.companyName} sent "${params.documentTitle}" for your signature. Open & sign here: ${params.signUrl}`;
}

export function normalizeWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function buildWhatsAppDeepLink(phone: string, text: string): string {
  const digits = normalizeWhatsAppDigits(phone);
  const encoded = encodeURIComponent(text);
  return digits
    ? `https://web.whatsapp.com/send?phone=${digits}&text=${encoded}`
    : `https://web.whatsapp.com/send?text=${encoded}`;
}

export function buildSmsDeepLink(phone: string, text: string): string {
  const cleanPhone = phone.replace(/[^\d+]/g, "");
  return `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
}

async function getSmtpTransport() {
  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });

  const host = settings?.smtpHost || process.env.SMTP_HOST || "";
  const port = settings?.smtpPort || Number(process.env.SMTP_PORT || 587);
  const user = settings?.smtpUser || process.env.SMTP_USER || "";
  const pass = settings?.smtpPass || process.env.SMTP_PASS || "";
  const from =
    settings?.smtpFrom ||
    process.env.SMTP_FROM ||
    `${settings?.companyName || "Standard Roofs"} <info@standardroofs.in>`;

  return { settings, host, port, user, pass, from };
}

export async function dispatchInvite(
  target: DispatchTarget
): Promise<DispatchResult> {
  const { settings, host, port, user, pass, from } = await getSmtpTransport();
  const companyName = settings?.companyName || "Standard Roofs";
  const textBody = buildShortMessage({
    signerName: target.name,
    companyName,
    documentTitle: target.documentTitle,
    signUrl: target.signUrl,
  });

  const result: DispatchResult = {
    email: { sent: false },
    whatsapp: {
      autoSent: false,
      deepLink: buildWhatsAppDeepLink(target.phone, textBody),
    },
    sms: {
      autoSent: false,
      deepLink: buildSmsDeepLink(target.phone, textBody),
    },
  };

  // 1. EMAIL
  if (target.channels.includes("EMAIL") && target.email) {
    if (host && user && pass) {
      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        });
        await transporter.sendMail({
          from,
          to: target.email,
          subject: `Signature Requested: ${target.documentTitle} (${companyName})`,
          html: `
            <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <div style="background:#0f172a;padding:20px 24px;border-bottom:4px solid #991b1b;">
                <h1 style="margin:0;color:#ffffff;font-size:20px;">${companyName}</h1>
                <p style="margin:4px 0 0;color:#cbd5e1;font-size:13px;">Electronic Signature Request</p>
              </div>
              <div style="padding:24px;background:#ffffff;color:#0f172a;">
                <p style="margin-top:0;">Hello <strong>${target.name}</strong>,</p>
                <p>Please review and sign: <strong>${target.documentTitle}</strong></p>
                ${target.message ? `<p style="color:#475569;font-size:14px;">${target.message}</p>` : ""}
                <div style="margin:24px 0;">
                  <a href="${target.signUrl}" style="display:inline-block;background:#991b1b;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
                    Review &amp; Sign Document
                  </a>
                </div>
                <p style="font-size:12px;color:#64748b;">Direct link: <a href="${target.signUrl}">${target.signUrl}</a></p>
              </div>
            </div>`,
        });
        result.email = { sent: true };
      } catch (err) {
        result.email = {
          sent: false,
          reason: err instanceof Error ? err.message : "SMTP error",
        };
      }
    } else {
      result.email = { sent: false, reason: "SMTP not configured in Settings" };
    }
  }

  // 2. WHATSAPP WEBHOOK (optional automatic API)
  if (
    target.channels.includes("WHATSAPP") &&
    target.phone &&
    settings?.whatsappWebhookUrl
  ) {
    try {
      const resp = await fetch(settings.whatsappWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "whatsapp",
          phone: target.phone,
          name: target.name,
          documentTitle: target.documentTitle,
          signUrl: target.signUrl,
          message: textBody,
        }),
      });
      result.whatsapp.autoSent = resp.ok;
      if (!resp.ok) result.whatsapp.reason = `Webhook HTTP ${resp.status}`;
    } catch (err) {
      result.whatsapp.reason =
        err instanceof Error ? err.message : "WhatsApp webhook failed";
    }
  }

  // 3. SMS (Fast2SMS or custom SMS webhook)
  if (target.channels.includes("SMS") && target.phone) {
    const clean10 = target.phone.replace(/\D/g, "").slice(-10);
    if (settings?.fast2smsApiKey && clean10.length === 10) {
      try {
        const resp = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            authorization: settings.fast2smsApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route: "q",
            message: textBody,
            numbers: clean10,
          }),
        });
        result.sms.autoSent = resp.ok;
        if (!resp.ok) result.sms.reason = `Fast2SMS HTTP ${resp.status}`;
      } catch (err) {
        result.sms.reason =
          err instanceof Error ? err.message : "Fast2SMS request failed";
      }
    } else if (settings?.smsWebhookUrl) {
      try {
        const resp = await fetch(settings.smsWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "sms",
            phone: target.phone,
            name: target.name,
            documentTitle: target.documentTitle,
            signUrl: target.signUrl,
            message: textBody,
          }),
        });
        result.sms.autoSent = resp.ok;
        if (!resp.ok) result.sms.reason = `SMS webhook HTTP ${resp.status}`;
      } catch (err) {
        result.sms.reason =
          err instanceof Error ? err.message : "SMS webhook failed";
      }
    }
  }

  return result;
}

export async function sendCompletedCopiesEmail(params: {
  documentTitle: string;
  recipientEmails: string[];
  pdfBuffer: Buffer;
}) {
  const { settings, host, port, user, pass, from } = await getSmtpTransport();
  if (!host || !user || !pass) return;

  const adminEmail = settings?.email || "";
  const allTargets = Array.from(
    new Set([...params.recipientEmails.filter(Boolean), adminEmail].filter(Boolean))
  );
  if (allTargets.length === 0) return;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const safeFilename =
    params.documentTitle.replace(/[^a-zA-Z0-9_-]/g, "_") + "-SIGNED.pdf";

  await transporter.sendMail({
    from,
    to: allTargets.join(", "),
    subject: `Completed & Signed: ${params.documentTitle}`,
    html: `<p>All parties have completed signing <strong>${params.documentTitle}</strong>. The finalized PDF with the Audit Certificate is attached for your records.</p>`,
    attachments: [
      {
        filename: safeFilename,
        content: params.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
