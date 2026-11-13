import nodemailer from "nodemailer";
import { prisma } from "./prisma";

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendPlatformEmail(opts: SendMailOptions): Promise<{
  sent: boolean;
  reason?: string;
}> {
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

  if (!host || !user || !pass) {
    return {
      sent: false,
      reason: "SMTP not configured — share signing link manually or via WhatsApp.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Failed to send SMTP email",
    };
  }
}

export function buildInviteEmailHtml(params: {
  companyName: string;
  signerName: string;
  documentTitle: string;
  projectName: string;
  message: string;
  signUrl: string;
}) {
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="background:#0f172a;padding:20px 24px;border-bottom:4px solid #c2410c;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;">${params.companyName}</h1>
      <p style="margin:4px 0 0;color:#cbd5e1;font-size:13px;">Document Signature Request</p>
    </div>
    <div style="padding:24px;background:#ffffff;color:#0f172a;">
      <p style="margin-top:0;">Hello <strong>${params.signerName}</strong>,</p>
      <p>You have been requested to review and electronically sign:</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin:16px 0;">
        <div style="font-weight:700;font-size:15px;">${params.documentTitle}</div>
        ${params.projectName ? `<div style="color:#475569;font-size:13px;margin-top:4px;">Project: ${params.projectName}</div>` : ""}
      </div>
      ${params.message ? `<p style="color:#334155;font-size:14px;">${params.message}</p>` : ""}
      <div style="margin:24px 0;">
        <a href="${params.signUrl}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Review &amp; Sign Document
        </a>
      </div>
      <p style="font-size:12px;color:#64748b;">Or open this link: <a href="${params.signUrl}">${params.signUrl}</a></p>
    </div>
  </div>`;
}

