"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send,
  ArrowLeft,
  Loader2,
  Users,
  User,
  MessageCircle,
  Mail,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Lock,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  type DocumentCategory,
  type SignerRole,
} from "@/lib/types";

interface TemplateOption {
  id: string;
  name: string;
  category: string;
  roles: SignerRole[];
}

interface SignerDraft {
  role: string;
  name: string;
  email: string;
  phone: string;
}

interface BulkResultItem {
  request: { id: string; title: string };
  signUrl: string;
  dispatch: {
    email: { sent: boolean; reason?: string };
    whatsapp: { autoSent: boolean; deepLink: string };
    sms: { autoSent: boolean; deepLink: string };
  };
}

const AVAILABLE_ATTACHMENTS = [
  { id: "pan", label: "PAN Card", desc: "Signer must upload clear photo of PAN card" },
  { id: "aadhaar", label: "Aadhaar Card (Masked)", desc: "UIDAI compliant with first 8 digits masked" },
  { id: "gst", label: "GST Certificate / Registration", desc: "Business tax registration proof" },
  { id: "cheque", label: "Cancelled Cheque / Bank Proof", desc: "Bank account verification proof" },
];

export default function NewRequestClient({
  templates,
  initialTemplateId,
  publicBaseUrl,
}: {
  templates: TemplateOption[];
  initialTemplateId?: string;
  publicBaseUrl: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"SINGLE" | "BULK">("SINGLE");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    initialTemplateId || templates[0]?.id || ""
  );
  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [signingOrder, setSigningOrder] = useState<"SEQUENTIAL" | "PARALLEL">(
    "SEQUENTIAL"
  );
  const [message, setMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [channels, setChannels] = useState<string[]>([
    "WHATSAPP",
    "EMAIL",
    "SMS",
  ]);
  const [requirePhotoLocation, setRequirePhotoLocation] = useState(false);
  const [isConfidential, setIsConfidential] = useState(false);
  const [accessPasscode, setAccessPasscode] = useState("");
  const [requireAttachments, setRequireAttachments] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [signers, setSigners] = useState<SignerDraft[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResultItem[] | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    setCategory(tpl.category);
    setTitle(tpl.name);
    setSigners(
      tpl.roles.map((r) => ({
        role: r.name,
        name: "",
        email: "",
        phone: "",
      }))
    );
  }, [selectedTemplateId, templates]);

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }

  function parseBulkText(): SignerDraft[] {
    return bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,\t;]+/).map((p) => p.trim());
        const name = parts[0] || "";
        let email = "";
        let phone = "";
        for (const part of parts.slice(1)) {
          if (part.includes("@")) email = part;
          else if (/\d{7,}/.test(part.replace(/\D/g, ""))) phone = part;
        }
        return { role: signers[0]?.role || "Recipient", name, email, phone };
      });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedTemplateId) {
      setError("Select a document template first.");
      return;
    }

    if (mode === "SINGLE") {
      for (const s of signers) {
        if (!s.name.trim() || (!s.email.trim() && !s.phone.trim())) {
          setError(
            `Enter Name and at least WhatsApp/Phone or Email for ${s.role}.`
          );
          return;
        }
      }
    }

    const bulkRecipients = mode === "BULK" ? parseBulkText() : [];
    if (mode === "BULK" && bulkRecipients.length === 0) {
      setError(
        "Paste at least one recipient line: Name, +91Phone, Email (or Name, +91Phone)"
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          templateId: selectedTemplateId,
          title,
          projectName,
          category,
          signingOrder,
          message,
          channels,
          requirePhotoLocation,
          isConfidential,
          accessPasscode: isConfidential ? accessPasscode.trim() : null,
          requiredAttachments: requireAttachments
            ? selectedAttachments.map((id) => {
                const found = AVAILABLE_ATTACHMENTS.find((a) => a.id === id);
                return { id, label: found?.label || id, required: true };
              })
            : [],
          signers,
          bulkRecipients,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send.");
        return;
      }

      if (mode === "BULK" && Array.isArray(data.items)) {
        setBulkResults(data.items);
      } else {
        router.push(`/requests/${data.request.id}`);
      }
    } catch {
      setError("Network error sending document.");
    } finally {
      setSubmitting(false);
    }
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center max-w-lg mx-auto">
        <h2 className="text-lg font-bold text-slate-900">No Documents Yet</h2>
        <p className="text-sm text-slate-500 mt-2">
          Upload a PDF document first and place your signature fields.
        </p>
        <Link
          href="/templates"
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-red-800 text-white text-sm font-semibold hover:bg-red-900"
        >
          Upload Document →
        </Link>
      </div>
    );
  }

  if (bulkResults) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <h2 className="font-bold text-emerald-900">
              {bulkResults.length} Individual Signing Links Created!
            </h2>
            <p className="text-xs text-emerald-800 mt-0.5">
              Click WhatsApp or SMS below to send each person their unique link.
            </p>
          </div>
          <Link
            href="/"
            className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
          >
            View All Submissions
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {bulkResults.map((item) => (
            <div
              key={item.request.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm text-slate-900 truncate">
                  {item.request.title}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {item.signUrl}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(item.signUrl);
                    setCopiedUrl(item.signUrl);
                    setTimeout(() => setCopiedUrl(null), 2000);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {copiedUrl === item.signUrl ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy
                </button>
                <a
                  href={item.dispatch.whatsapp.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
                <a
                  href={item.dispatch.sms.deepLink}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  SMS
                </a>
                <Link
                  href={`/requests/${item.request.id}`}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Send Document</h1>
          <p className="text-xs text-slate-500">
            Send to one person, multiple parties, or bulk list via WhatsApp, Email &amp; SMS.
          </p>
        </div>
      </div>

      {!publicBaseUrl &&
        typeof window !== "undefined" &&
        window.location.hostname === "localhost" && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              You are on <strong>localhost</strong>. Links copied here only open on this PC. To send working links to clients&apos; phones, set your Public Domain or Tunnel URL in{" "}
              <Link href="/settings" className="underline font-semibold">
                Settings → Public Link URL
              </Link>
              .
            </span>
          </div>
        )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-5 rounded-xl border border-slate-200 space-y-5 shadow-2xs"
      >
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Document Picker */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Document
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Mode Toggle: Single vs Bulk */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setMode("SINGLE")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
              mode === "SINGLE"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Single / Multi-Party
          </button>
          <button
            type="button"
            onClick={() => setMode("BULK")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
              mode === "BULK"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Bulk Send (Multiple People)
          </button>
        </div>

        {/* Recipients */}
        {mode === "SINGLE" ? (
          <div className="space-y-3">
            {signers.map((signer, idx) => (
              <div
                key={`${signer.role}-${idx}`}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
              >
                <div className="text-xs font-bold text-red-800 uppercase">
                  {signer.role}
                </div>
                <div className="grid sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Full Name *"
                    value={signer.name}
                    onChange={(e) =>
                      setSigners((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, name: e.target.value } : s
                        )
                      )
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                  <input
                    type="tel"
                    placeholder="WhatsApp / SMS (+91...)"
                    value={signer.phone}
                    onChange={(e) =>
                      setSigners((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, phone: e.target.value } : s
                        )
                      )
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={signer.email}
                    onChange={(e) =>
                      setSigners((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, email: e.target.value } : s
                        )
                      )
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Paste Recipients (one per line:{" "}
              <code className="font-mono bg-slate-100 px-1 rounded">
                Name, +919876543210, email@domain.com
              </code>
              )
            </label>
            <textarea
              rows={5}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Karthik R, +919876543210, karthik@gmail.com\nSuresh K, +919842211223\nAnitha M, anitha@standardroofs.in`}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
            <div className="text-[11px] text-slate-500">
              Each person gets their own private document copy &amp; tracking record.
            </div>
          </div>
        )}

        {/* 3-Way Delivery Channels */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Delivery Channels
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                id: "WHATSAPP",
                label: "WhatsApp",
                icon: MessageCircle,
                activeCls: "bg-emerald-50 border-emerald-600 text-emerald-800",
              },
              {
                id: "EMAIL",
                label: "Email",
                icon: Mail,
                activeCls: "bg-red-50 border-red-700 text-red-900",
              },
              {
                id: "SMS",
                label: "SMS",
                icon: Smartphone,
                activeCls: "bg-blue-50 border-blue-600 text-blue-800",
              },
            ].map((ch) => {
              const Icon = ch.icon;
              const on = channels.includes(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => toggleChannel(ch.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                    on
                      ? ch.activeCls
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{ch.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Security, Confidentiality & KYC Suite */}
        <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/20 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-700" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Security, Confidentiality &amp; KYC Proofs
              </span>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
              Bank-Grade Protection
            </span>
          </div>

          {/* Access PIN Gate */}
          <div className="space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => {
                  setIsConfidential(e.target.checked);
                  if (!e.target.checked) setAccessPasscode("");
                }}
                className="mt-0.5 accent-indigo-700 rounded"
              />
              <div>
                <span>Lock Document with Access Passcode / PIN</span>
                <p className="text-[11px] font-normal text-slate-500">
                  Recipient cannot view or sign the document without entering this PIN.
                </p>
              </div>
            </label>

            {isConfidential && (
              <div className="ml-6 flex items-center gap-2 max-w-xs">
                <input
                  type="text"
                  maxLength={12}
                  value={accessPasscode}
                  onChange={(e) => setAccessPasscode(e.target.value)}
                  placeholder="Enter 4-6 digit PIN or secret word (e.g. 5824)"
                  className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-xs font-mono bg-white shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Biometric Proof of Presence */}
          <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={requirePhotoLocation}
              onChange={(e) => setRequirePhotoLocation(e.target.checked)}
              className="mt-0.5 accent-indigo-700 rounded"
            />
            <div>
              <span>Biometric Sign-on-Selfie &amp; GPS Location Stamp</span>
              <p className="text-[11px] font-normal text-slate-500">
                Signer must capture live front-camera selfie &amp; GPS landmark to verify presence.
              </p>
            </div>
          </label>

          {/* KYC ID Attachments */}
          <div className="space-y-2 pt-2 border-t border-slate-200/60">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={requireAttachments}
                onChange={(e) => {
                  setRequireAttachments(e.target.checked);
                  if (!e.target.checked) setSelectedAttachments([]);
                  else if (selectedAttachments.length === 0) setSelectedAttachments(["pan"]);
                }}
                className="mt-0.5 accent-indigo-700 rounded"
              />
              <div>
                <span>Mandatory Official KYC ID Attachments (PAN / Aadhaar / GST)</span>
                <p className="text-[11px] font-normal text-slate-500">
                  Signer must upload official photo ID attachments before finalizing signature.
                </p>
              </div>
            </label>

            {requireAttachments && (
              <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {AVAILABLE_ATTACHMENTS.map((att) => {
                  const checked = selectedAttachments.includes(att.id);
                  return (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() =>
                        setSelectedAttachments((prev) =>
                          prev.includes(att.id)
                            ? prev.filter((x) => x !== att.id)
                            : [...prev, att.id]
                        )
                      }
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex items-start gap-2 ${
                        checked
                          ? "bg-indigo-50/80 border-indigo-400 text-indigo-950 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        className="mt-0.5 accent-indigo-700 pointer-events-none"
                      />
                      <div>
                        <div className="text-xs font-bold">{att.label}</div>
                        <div className="text-[10px] text-slate-500 leading-tight">{att.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Optional Collapsible Details */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            <span>Optional Details (Title, Project, Message)</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document Title"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project / Site / Department"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={signingOrder}
                  onChange={(e) =>
                    setSigningOrder(
                      e.target.value as "SEQUENTIAL" | "PARALLEL"
                    )
                  }
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="SEQUENTIAL">Sequential Order</option>
                  <option value="PARALLEL">Parallel (All at once)</option>
                </select>
              </div>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional note to recipient..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-900 disabled:opacity-60 text-white font-semibold text-sm cursor-pointer"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>
            {mode === "BULK"
              ? "Generate All Signing Links"
              : "Send & Get Signing Links"}
          </span>
        </button>
      </form>
    </div>
  );
}
