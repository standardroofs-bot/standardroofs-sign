"use client";

import { useEffect, useState, use } from "react";
import PdfCanvasViewer from "@/components/PdfCanvasViewer";
import SignaturePadModal from "@/components/SignaturePadModal";
import PhotoLocationCapture from "@/components/PhotoLocationCapture";
import {
  FileSignature,
  CheckCircle2,
  Download,
  Clock,
  AlertTriangle,
  Loader2,
  PenTool,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Upload,
  Trash2,
  Camera,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import type { DocumentField } from "@/lib/types";

interface SigningSessionData {
  company: {
    name: string;
    tagline: string;
    website: string;
    phone: string;
  };
  signer: {
    id: string;
    role: string;
    name: string;
    email: string;
    status: string;
    signedAt: string | null;
    passcodeVerified?: boolean;
  };
  request: {
    id: string;
    title: string;
    projectName: string;
    category: string;
    message: string;
    status: string;
    requirePhotoLocation?: boolean;
    isConfidential?: boolean;
    requiresPasscode?: boolean;
    isPasscodeVerified?: boolean;
    requiredAttachments?: Array<{ id: string; label: string; required: boolean }>;
    attachments?: Array<{ id: string; label: string; name?: string; dataUrl: string }>;
    signedHash: string | null;
    hasSignedPdf: boolean;
    signers: {
      id: string;
      role: string;
      name: string;
      status: string;
      signedAt: string | null;
    }[];
    fields: DocumentField[];
  };
}

export default function SignDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<SigningSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [activeSigField, setActiveSigField] = useState<DocumentField | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [verifyingPasscode, setVerifyingPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");
  const [showPasscodeText, setShowPasscodeText] = useState(false);
  const [attachments, setAttachments] = useState<
    Array<{ id: string; label: string; name?: string; dataUrl: string }>
  >([]);
  const [photoLoc, setPhotoLoc] = useState<{
    photoDataUrl: string;
    latitude: number | null;
    longitude: number | null;
    locationLabel: string;
    locationAddress?: string;
  }>({
    photoDataUrl: "",
    latitude: null,
    longitude: null,
    locationLabel: "",
    locationAddress: "",
  });

  async function loadSession() {
    try {
      setLoading(true);
      const res = await fetch(`/api/sign/${token}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Invalid signing link.");
        return;
      }
      setData(json);

      // Auto-populate name and today's date fields for convenience
      const today = new Date().toISOString().slice(0, 10);
      const defaults: Record<string, string> = {};
      for (const f of json.request.fields as DocumentField[]) {
        if (f.role === json.signer.role) {
          if (f.type === "name") defaults[f.id] = json.signer.name;
          if (f.type === "date") defaults[f.id] = today;
        }
      }
      setFieldValues((prev) => ({ ...defaults, ...prev }));
    } catch {
      setError("Could not load signing document.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleVerifyPasscode(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) {
      setPasscodeError("Please enter your Access PIN.");
      return;
    }
    setVerifyingPasscode(true);
    setPasscodeError("");
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY_PASSCODE", passcode: passcode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasscodeError(json.error || "Incorrect PIN. Please verify with the sender.");
        return;
      }
      await loadSession();
    } catch {
      setPasscodeError("Network error. Please try again.");
    } finally {
      setVerifyingPasscode(false);
    }
  }

  async function handleSubmit() {
    if (!data) return;
    setError("");

    // Validate mandatory KYC attachments
    if (data.request.requiredAttachments && data.request.requiredAttachments.length > 0) {
      for (const reqAtt of data.request.requiredAttachments) {
        if (reqAtt.required && !attachments.some((a) => a.id === reqAtt.id && Boolean(a.dataUrl))) {
          setError(`Please attach required official document: ${reqAtt.label}`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldValues,
          attachments,
          photoDataUrl: photoLoc.photoDataUrl || null,
          latitude: photoLoc.latitude,
          longitude: photoLoc.longitude,
          locationLabel: photoLoc.locationLabel || null,
          locationAddress: photoLoc.locationAddress || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Please complete all required fields.");
        return;
      }
      setSubmittedOk(true);
      await loadSession();
    } catch {
      setError("Network error submitting signature.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-orange-700" />
          Loading Standard Roofs document...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-md w-full text-center space-y-2">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="font-bold text-slate-900 text-lg">Link Unavailable</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (data.request.requiresPasscode && !data.request.isPasscodeVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-indigo-50 border-2 border-indigo-200 text-indigo-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Confidential Document
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Access Passcode Required
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong>{data.company.name}</strong> has protected{" "}
              <span className="text-slate-800 font-semibold">&ldquo;{data.request.title}&rdquo;</span>{" "}
              with an access PIN. Please enter your PIN to view and sign.
            </p>
          </div>

          <form onSubmit={handleVerifyPasscode} className="space-y-4">
            {passcodeError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{passcodeError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Enter Document PIN
              </label>
              <div className="relative">
                <input
                  type={showPasscodeText ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter 4-6 digit PIN"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-center tracking-widest text-lg font-mono font-bold text-slate-900 outline-hidden transition"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasscodeText(!showPasscodeText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {showPasscodeText ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Contact the sender if you do not have the access PIN.
              </p>
            </div>

            <button
              type="submit"
              disabled={verifyingPasscode || !passcode.trim()}
              className="w-full py-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {verifyingPasscode ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying PIN...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Unlock &amp; View Document</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center">
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bank-Grade 256-Bit Encrypted Access</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const myFields = data.request.fields.filter(
    (f) => f.role === data.signer.role
  );
  const requiredFields = myFields.filter((f) => f.required);
  const completedRequired = requiredFields.filter((f) =>
    Boolean(String(fieldValues[f.id] || "").trim())
  ).length;

  const isCompleted = data.request.status === "COMPLETED";
  const isVoided = data.request.status === "VOIDED";
  const isWaiting = data.signer.status === "WAITING";
  const alreadySigned = data.signer.status === "SIGNED";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Branded Header */}
      <header className="bg-slate-900 text-white border-b-4 border-red-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-800 flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base leading-tight">
                {data.company.name}
              </div>
              <div className="text-[11px] text-slate-400">
                {data.company.tagline} • {data.company.phone}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.request.hasSignedPdf && (
              <a
                href={`/api/sign/${token}/pdf?variant=signed&download=1`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                Download Signed PDF
              </a>
            )}
            {!alreadySigned && !isVoided && !isWaiting && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-700 hover:bg-orange-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Sign &amp; Submit</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-4 py-6 space-y-5">
        {/* Document Info Banner */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                {data.request.title}
              </h1>
              {data.request.projectName && (
                <div className="text-xs text-slate-500 mt-0.5">
                  Project: {data.request.projectName}
                </div>
              )}
            </div>
            <div className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-50 text-orange-800 border border-orange-200">
              Signing as: {data.signer.name} ({data.signer.role})
            </div>
          </div>

          {data.request.message && (
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {data.request.message}
            </p>
          )}

          {!alreadySigned && !isVoided && !isWaiting && (
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <span>
                Click each highlighted field on the document below to complete it.
              </span>
              <span className="font-semibold text-orange-800">
                {completedRequired} / {requiredFields.length} required fields ready
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {(submittedOk || alreadySigned) && (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-emerald-900">
                  {isCompleted
                    ? "Document Fully Signed & Sealed!"
                    : "Your Signature Has Been Recorded!"}
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  {isCompleted
                    ? "All parties have signed. You can download the final PDF with the Standard Roofs Audit Certificate."
                    : "Your signed copy is ready to download below. Waiting for the remaining signer(s) to counter-sign."}
                </p>
              </div>
            </div>
            {data.request.hasSignedPdf && (
              <a
                href={`/api/sign/${token}/pdf?variant=signed&download=1`}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shrink-0"
              >
                <Download className="w-4 h-4" />
                Download Signed PDF
              </a>
            )}
          </div>
        )}

        {isWaiting && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-900 text-sm">
            <Clock className="w-5 h-5 shrink-0" />
            <span>
              This document uses sequential signing. You will be notified as soon as the previous signer completes their turn.
            </span>
          </div>
        )}

        {isVoided && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-800 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>This signature request has been voided by Standard Roofs.</span>
          </div>
        )}

        {/* Required KYC Official Documents */}
        {!alreadySigned && !isVoided && !isWaiting && data.request.requiredAttachments && data.request.requiredAttachments.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border-2 border-indigo-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-800">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Required Official KYC Documents
                  </h2>
                  <p className="text-xs text-slate-500">
                    The sender requires you to attach official identity proofs before signing.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                {attachments.length} of {data.request.requiredAttachments.length} Uploaded
              </span>
            </div>

            {/* UIDAI Aadhaar Masking Notice if Aadhaar is requested */}
            {data.request.requiredAttachments.some((a) => a.id.toLowerCase().includes("aadhaar")) && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">UIDAI Aadhaar Masking Advisory:</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    As per UIDAI guidelines, please ensure the first 8 digits of your 12-digit Aadhaar number are covered or masked (e.g. <code>XXXX-XXXX-1234</code>) before uploading.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.request.requiredAttachments.map((reqAtt) => {
                const uploaded = attachments.find((a) => a.id === reqAtt.id);
                return (
                  <div
                    key={reqAtt.id}
                    className={`p-3.5 rounded-xl border-2 transition ${
                      uploaded
                        ? "bg-emerald-50/50 border-emerald-300"
                        : "bg-slate-50 border-dashed border-slate-300 hover:border-indigo-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {uploaded ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          )}
                          <span>{reqAtt.label}</span>
                          <span className="text-red-500">*</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {uploaded ? uploaded.name || "File attached" : "Upload clear photo or document"}
                        </p>
                      </div>

                      {uploaded && (
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) => prev.filter((a) => a.id !== reqAtt.id))
                          }
                          className="p-1 rounded-md text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Remove Attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {uploaded ? (
                      <div className="mt-2.5 relative rounded-lg overflow-hidden border border-emerald-200 bg-white max-h-32 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={uploaded.dataUrl}
                          alt={reqAtt.label}
                          className="max-h-32 w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mt-2.5">
                        <label className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-2xs transition">
                          <Camera className="w-3.5 h-3.5" />
                          <span>Choose File or Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (typeof reader.result === "string") {
                                  const dataUrl = reader.result;
                                  setAttachments((prev) => [
                                    ...prev.filter((a) => a.id !== reqAtt.id),
                                    {
                                      id: reqAtt.id,
                                      label: reqAtt.label,
                                      name: file.name,
                                      dataUrl,
                                    },
                                  ]);
                                }
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!alreadySigned && !isVoided && !isWaiting && (
          <PhotoLocationCapture
            required={Boolean(data.request.requirePhotoLocation)}
            signerName={data.signer.name}
            token={data.signer.role}
            photoDataUrl={photoLoc.photoDataUrl}
            latitude={photoLoc.latitude}
            longitude={photoLoc.longitude}
            locationLabel={photoLoc.locationLabel}
            locationAddress={photoLoc.locationAddress}
            onChange={(newData) => {
              setPhotoLoc(newData);
              if (newData.rawSignatureDataUrl) {
                // If signer drew on selfie, auto-populate any empty signature fields on document
                setFieldValues((prev) => {
                  const updated = { ...prev };
                  for (const f of myFields) {
                    if ((f.type === "signature" || f.type === "initials") && !updated[f.id]) {
                      updated[f.id] = newData.rawSignatureDataUrl!;
                    }
                  }
                  return updated;
                });
              }
            }}
          />
        )}

        {/* PDF Canvas with Interactive Fields */}
        <PdfCanvasViewer
          pdfUrl={`/api/sign/${token}/pdf${data.request.hasSignedPdf ? "?variant=signed" : ""}`}
          renderOverlay={(pageNumber) => {
            if (alreadySigned || isVoided || isWaiting) return null;
            return myFields
              .filter((f) => f.page === pageNumber)
              .map((f) => {
                const val = fieldValues[f.id] || "";
                const isSigType =
                  f.type === "signature" ||
                  f.type === "initials" ||
                  f.type === "stamp";

                return (
                  <div
                    key={f.id}
                    style={{
                      left: `${f.x * 100}%`,
                      top: `${f.y * 100}%`,
                      width: `${f.width * 100}%`,
                      height: `${f.height * 100}%`,
                    }}
                    className={`absolute rounded-md border-2 transition ${
                      val
                        ? "border-emerald-600 bg-emerald-50/40"
                        : "border-orange-600 bg-orange-50/75 animate-pulse"
                    }`}
                  >
                    {isSigType ? (
                      <button
                        type="button"
                        onClick={() => setActiveSigField(f)}
                        className="w-full h-full flex items-center justify-center p-1 cursor-pointer"
                      >
                        {val ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={val}
                            alt={f.label}
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-orange-800">
                            <PenTool className="w-3.5 h-3.5" />
                            <span className="truncate">{f.label}</span>
                          </span>
                        )}
                      </button>
                    ) : f.type === "checkbox" ? (
                      <label className="w-full h-full flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={val === "true"}
                          onChange={(e) =>
                            setFieldValues((prev) => ({
                              ...prev,
                              [f.id]: e.target.checked ? "true" : "",
                            }))
                          }
                          className="w-4 h-4 accent-orange-700"
                        />
                      </label>
                    ) : (
                      <input
                        type={f.type === "date" ? "date" : "text"}
                        value={val}
                        placeholder={f.label}
                        onChange={(e) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.id]: e.target.value,
                          }))
                        }
                        className="w-full h-full px-1.5 text-xs bg-white/90 text-slate-900 font-medium rounded-sm focus:outline-none"
                      />
                    )}
                  </div>
                );
              });
          }}
        />
      </main>

      <SignaturePadModal
        isOpen={Boolean(activeSigField)}
        title={activeSigField?.label || "Add Signature"}
        defaultText={
          activeSigField?.type === "stamp"
            ? data.company.name.toUpperCase()
            : data.signer.name
        }
        isStamp={activeSigField?.type === "stamp"}
        onClose={() => setActiveSigField(null)}
        onSave={(dataUrl) => {
          if (activeSigField) {
            setFieldValues((prev) => ({
              ...prev,
              [activeSigField.id]: dataUrl,
            }));
          }
          setActiveSigField(null);
        }}
      />
    </div>
  );
}

