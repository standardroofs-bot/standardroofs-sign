"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  MessageCircle,
  Ban,
  ShieldCheck,
  Clock,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Trash2,
} from "lucide-react";
import { CATEGORY_LABELS, type DocumentCategory } from "@/lib/types";

interface RequestDetailProps {
  request: {
    id: string;
    title: string;
    projectName: string;
    category: string;
    message: string;
    status: string;
    signingOrder: string;
    originalHash: string;
    signedHash: string | null;
    hasSignedPdf: boolean;
    createdAt: string;
    completedAt: string | null;
    signers: {
      id: string;
      role: string;
      name: string;
      email: string;
      phone: string;
      status: string;
      token: string;
      viewedAt: string | null;
      signedAt: string | null;
      ipAddress: string | null;
    }[];
    auditEvents: {
      id: string;
      action: string;
      details: string;
      ipAddress: string | null;
      createdAt: string;
    }[];
  };
}

export default function RequestDetailClient({
  request,
  publicBaseUrl = "",
}: RequestDetailProps & { publicBaseUrl?: string }) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);

  function getSignUrl(token: string) {
    if (typeof window !== "undefined") {
      const currentOrigin = window.location.origin.replace(/\/+$/, "");
      const isOutdatedTunnel =
        publicBaseUrl.includes("trycloudflare.com") &&
        !publicBaseUrl.includes(window.location.host);

      // If on localhost or if publicBaseUrl is missing/outdated tunnel, use current origin
      if (!publicBaseUrl || isOutdatedTunnel || window.location.hostname === "localhost") {
        return `${currentOrigin}/s/${token}`;
      }
      return `${publicBaseUrl.replace(/\/+$/, "")}/s/${token}`;
    }
    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/+$/, "")}/s/${token}`;
    }
    return `/s/${token}`;
  }

  async function copyLink(signerId: string, token: string) {
    const url = getSignUrl(token);
    await navigator.clipboard.writeText(url);
    setCopiedId(signerId);
    setTimeout(() => setCopiedId(null), 2500);
  }

  function buildShareMessage(
    signer: RequestDetailProps["request"]["signers"][number]
  ) {
    const signUrl = getSignUrl(signer.token);
    return `Hello ${signer.name},\n\nStandard Roofs has sent you "${request.title}"${
      request.projectName ? ` (${request.projectName})` : ""
    } for electronic signature.\n\nReview & Sign here:\n${signUrl}`;
  }

  function openWhatsApp(
    signer: RequestDetailProps["request"]["signers"][number],
    useDesktopApp = false
  ) {
    let digits = signer.phone.replace(/\D/g, "");
    if (digits.length === 10) digits = `91${digits}`;
    const text = encodeURIComponent(buildShareMessage(signer));
    if (useDesktopApp) {
      window.location.href = digits
        ? `whatsapp://send?phone=${digits}&text=${text}`
        : `whatsapp://send?text=${text}`;
      return;
    }
    const waUrl = digits
      ? `https://web.whatsapp.com/send?phone=${digits}&text=${text}`
      : `https://web.whatsapp.com/send?text=${text}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  function openSms(signer: RequestDetailProps["request"]["signers"][number]) {
    const cleanPhone = signer.phone.replace(/[^\d+]/g, "");
    const text = encodeURIComponent(buildShareMessage(signer));
    window.location.href = `sms:${cleanPhone}?body=${text}`;
  }

  async function handleVoid() {
    if (!confirm("Void this signature request? Signers will no longer be able to sign it.")) {
      return;
    }
    setVoiding(true);
    try {
      await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void" }),
      });
      router.refresh();
    } finally {
      setVoiding(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${request.title}" permanently?`)) return;
    const res = await fetch(`/api/requests/${request.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 mt-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">
                {request.title}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                {request.status}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
              <span>
                {CATEGORY_LABELS[request.category as DocumentCategory] ||
                  request.category}
              </span>
              {request.projectName && <span>Project: {request.projectName}</span>}
              <span>Order: {request.signingOrder}</span>
              <span>ID: {request.id}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/requests/${request.id}/pdf?variant=original&download=1`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Original PDF
          </a>
          {request.hasSignedPdf && (
            <a
              href={`/api/requests/${request.id}/pdf?variant=signed&download=1`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Download Signed PDF + Certificate
            </a>
          )}
          {request.status !== "COMPLETED" && request.status !== "VOIDED" && (
            <button
              onClick={handleVoid}
              disabled={voiding}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              Void
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Signers & Share Links */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 font-semibold text-slate-900">
          Signers &amp; Sharing Links
        </div>
        <div className="divide-y divide-slate-100">
          {request.signers.map((s) => (
            <div
              key={s.id}
              className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{s.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-800 font-semibold border border-orange-200">
                    {s.role}
                  </span>
                  {s.status === "SIGNED" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Signed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <Clock className="w-3.5 h-3.5" />
                      {s.status}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                  <span>{s.email || "No email"}</span>
                  {s.phone && <span>• {s.phone}</span>}
                  {s.viewedAt && (
                    <span className="text-blue-700 font-medium">
                      • Opened {new Date(s.viewedAt).toLocaleString()}
                    </span>
                  )}
                  {s.signedAt && (
                    <span className="text-emerald-700 font-medium">
                      • Signed {new Date(s.signedAt).toLocaleString()}
                    </span>
                  )}
                  {s.ipAddress && <span>• IP: {s.ipAddress}</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyLink(s.id, s.token)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  {copiedId === s.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Signing Link
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => openWhatsApp(s, false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  title="Opens directly in WhatsApp Web (skips api.whatsapp.com screen)"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp Web
                </button>

                <button
                  type="button"
                  onClick={() => openWhatsApp(s, true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold cursor-pointer"
                  title="Opens directly in WhatsApp Desktop App"
                >
                  WA App
                </button>

                <button
                  type="button"
                  onClick={() => openSms(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Send via SMS
                </button>

                <Link
                  href={`/s/${s.token}`}
                  target="_blank"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  <span>Open Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cryptographic Hashes & Audit Log */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <ShieldCheck className="w-5 h-5 text-orange-700" />
            <span>Tamper-Evidence Checksums</span>
          </div>
          <div className="text-xs space-y-2">
            <div>
              <div className="font-semibold text-slate-600">
                Original PDF SHA-256:
              </div>
              <code className="block mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg break-all text-[11px] text-slate-700">
                {request.originalHash}
              </code>
            </div>
            {request.signedHash && (
              <div>
                <div className="font-semibold text-emerald-700">
                  Final Signed PDF SHA-256:
                </div>
                <code className="block mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg break-all text-[11px] text-emerald-900">
                  {request.signedHash}
                </code>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <div className="font-semibold text-slate-900">Audit Trail</div>
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {request.auditEvents.map((ev) => (
              <div
                key={ev.id}
                className="text-xs border-l-2 border-orange-600 pl-3 py-0.5"
              >
                <div className="font-semibold text-slate-800">
                  {ev.action} —{" "}
                  <span className="font-normal text-slate-500">
                    {new Date(ev.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-slate-600">{ev.details}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

