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
  organizationId?: string;
  organization?: {
    name?: string;
    website?: string;
    accentColor?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpFrom?: string;
    whatsappApiToken?: string;
    whatsappPhoneNumberId?: string;
    whatsappWebhookUrl?: string;
    fast2smsApiKey?: string;
  } | null;
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
  return `Hello ${params.signerName}, ${params.companyName} sent "${params.documentTitle}" for your electronic signature. Review & sign here: ${params.signUrl}`;
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

export async function dispatchInvite(
  target: DispatchTarget
): Promise<DispatchResult> {
  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });

  const org =
    target.organization ||
    (target.organizationId
      ? await prisma.organization.findUnique({ where: { id: target.organizationId } })
      : null);

  const companyName = org?.name || settings?.companyName || "Standard e-Sign";
  const accentColor = org?.accentColor || settings?.accentColor || "#991B1B";
  const host = org?.smtpHost || settings?.smtpHost || process.env.SMTP_HOST || "";
  const port = org?.smtpPort || settings?.smtpPort || Number(process.env.SMTP_PORT || 587);
  const user = org?.smtpUser || settings?.smtpUser || process.env.SMTP_USER || "";
  const pass = org?.smtpPass || settings?.smtpPass || process.env.SMTP_PASS || "";
  const from =
    org?.smtpFrom ||
    settings?.smtpFrom ||
    process.env.SMTP_FROM ||
    `${companyName} <noreply@standardesign.in>`;

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

  // 1. EMAIL DISPATCH (Custom Org SMTP or Platform Fallback)
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
              <div style="background:#0f172a;padding:20px 24px;border-bottom:4px solid ${accentColor};">
                <h1 style="margin:0;color:#ffffff;font-size:20px;">${companyName}</h1>
                <p style="margin:4px 0 0;color:#cbd5e1;font-size:13px;">Electronic Signature Request</p>
              </div>
              <div style="padding:24px;background:#ffffff;color:#0f172a;">
                <p style="margin-top:0;">Hello <strong>${target.name}</strong>,</p>
                <p>Please review and sign: <strong>${target.documentTitle}</strong></p>
                ${target.message ? `<p style="color:#475569;font-size:14px;background:#f8fafc;padding:12px;border-radius:8px;">${target.message}</p>` : ""}
                <div style="margin:24px 0;">
                  <a href="${target.signUrl}" style="display:inline-block;background:${accentColor};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
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
      result.email = { sent: false, reason: "SMTP not configured" };
    }
  }

  // 2. WHATSAPP AUTOMATED DISPATCH (Meta Cloud API / Webhook)
  if (target.channels.includes("WHATSAPP") && target.phone) {
    const waToken =
      org?.whatsappApiToken ||
      process.env.WHATSAPP_API_TOKEN ||
      process.env.WHATSAPP_CLOUD_API_TOKEN;
    const waPhoneId =
      org?.whatsappPhoneNumberId ||
      process.env.WHATSAPP_PHONE_NUMBER_ID;
    const cleanDigits = normalizeWhatsAppDigits(target.phone);

    // 2A. Meta WhatsApp Cloud API
    if (waToken && waPhoneId && cleanDigits) {
      try {
        const resp = await fetch(
          `https://graph.facebook.com/v19.0/${waPhoneId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: cleanDigits,
              type: "text",
              text: { body: textBody },
            }),
          }
        );
        result.whatsapp.autoSent = resp.ok;
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          result.whatsapp.reason = errData?.error?.message || `WhatsApp HTTP ${resp.status}`;
        }
      } catch (err) {
        result.whatsapp.reason = err instanceof Error ? err.message : "WhatsApp Cloud API error";
      }
    } else if (org?.whatsappWebhookUrl || settings?.whatsappWebhookUrl) {
      // 2B. Generic Webhook (e.g. AiSensy / Wati)
      const hookUrl = org?.whatsappWebhookUrl || settings?.whatsappWebhookUrl || "";
      try {
        const resp = await fetch(hookUrl, {
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
      } catch (err) {
        result.whatsapp.reason = err instanceof Error ? err.message : "WhatsApp webhook failed";
      }
    }
  }

  // 3. SMS AUTOMATED DISPATCH (MSG91 or Fast2SMS)
  if (target.channels.includes("SMS") && target.phone) {
    const clean10 = target.phone.replace(/\D/g, "").slice(-10);
    const msg91Auth = process.env.MSG91_AUTH_KEY;
    const msg91Template = process.env.MSG91_TEMPLATE_ID;
    const fast2smsKey = org?.fast2smsApiKey || settings?.fast2smsApiKey;

    // 3A. MSG91 Flow API
    if (msg91Auth && msg91Template && clean10.length === 10) {
      try {
        const resp = await fetch("https://control.msg91.com/api/v5/flow/", {
          method: "POST",
          headers: {
            authkey: msg91Auth,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_id: msg91Template,
            recipients: [
              {
                mobiles: `91${clean10}`,
                name: target.name,
                doc_title: target.documentTitle,
                sign_url: target.signUrl,
              },
            ],
          }),
        });
        result.sms.autoSent = resp.ok;
      } catch (err) {
        result.sms.reason = err instanceof Error ? err.message : "MSG91 dispatch error";
      }
    } else if (fast2smsKey && clean10.length === 10) {
      // 3B. Fast2SMS API
      try {
        const resp = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            authorization: fast2smsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route: "q",
            message: textBody,
            numbers: clean10,
          }),
        });
        result.sms.autoSent = resp.ok;
      } catch (err) {
        result.sms.reason = err instanceof Error ? err.message : "Fast2SMS dispatch error";
      }
    }
  }

  return result;
}

export async function sendCompletedCopiesEmail(params: {
  documentTitle: string;
  projectName: string;
  recipients: { name: string; email: string }[];
  pdfBuffer: Buffer;
  organization?: {
    name?: string;
    accentColor?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpFrom?: string;
  } | null;
}): Promise<void> {
  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });

  const org = params.organization;
  const companyName = org?.name || settings?.companyName || "Standard e-Sign";
  const accentColor = org?.accentColor || settings?.accentColor || "#16a34a";
  const host = org?.smtpHost || settings?.smtpHost || process.env.SMTP_HOST || "";
  const port = org?.smtpPort || settings?.smtpPort || Number(process.env.SMTP_PORT || 587);
  const user = org?.smtpUser || settings?.smtpUser || process.env.SMTP_USER || "";
  const pass = org?.smtpPass || settings?.smtpPass || process.env.SMTP_PASS || "";
  const from =
    org?.smtpFrom ||
    settings?.smtpFrom ||
    process.env.SMTP_FROM ||
    `${companyName} <noreply@standardesign.in>`;

  if (!host || !user || !pass) return;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const safeTitle = params.documentTitle.replace(/[^a-zA-Z0-9_-]/g, "_");

  for (const r of params.recipients) {
    if (!r.email) continue;
    try {
      await transporter.sendMail({
        from,
        to: r.email,
        subject: `Completed Copy: ${params.documentTitle} (Signed & Sealed)`,
        html: `
          <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <div style="background:#0f172a;padding:20px 24px;border-bottom:4px solid ${accentColor};">
              <h1 style="margin:0;color:#ffffff;font-size:20px;">${companyName}</h1>
              <p style="margin:4px 0 0;color:#86efac;font-size:13px;">Document Execution Completed</p>
            </div>
            <div style="padding:24px;background:#ffffff;color:#0f172a;">
              <p style="margin-top:0;">Hello <strong>${r.name}</strong>,</p>
              <p>All signers have electronically signed and verified <strong>"${params.documentTitle}"</strong>.</p>
              <p style="font-size:14px;color:#475569;">
                The finalized document with embedded signatures, photo/location audit certificates, and cryptographic SHA-256 seal is attached to this email.
              </p>
            </div>
          </div>`,
        attachments: [
          {
            filename: `${safeTitle}_Signed_Sealed.pdf`,
            content: params.pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
    } catch (err) {
      console.error(`Failed to send completed email to ${r.email}:`, err);
    }
  }
}
