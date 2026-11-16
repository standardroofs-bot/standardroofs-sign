"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FilePlus2,
  Trash2,
  SlidersHorizontal,
  Send,
  Sparkles,
  Loader2,
} from "lucide-react";
import { CATEGORY_LABELS, type DocumentCategory } from "@/lib/types";

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  description: string;
  pageCount: number;
  fieldsCount: number;
  requestsCount: number;
  updatedAt: string;
}

export default function TemplatesClient({
  initialTemplates,
}: {
  initialTemplates: TemplateItem[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateItem[]>(initialTemplates);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("QUOTATION_BOQ");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF file to upload.");
      return;
    }
    setError("");
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append(
        "name",
        name || file.name.replace(/\.(pdf|docx|doc|xlsx|xls|csv)$/i, "")
      );
      fd.append("category", category);
      fd.append("file", file);
      const res = await fetch("/api/templates", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      router.push(`/templates/${data.template.id}`);
    } catch {
      setError("Network error uploading template.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateSample(
    sampleKind: "quotation" | "fabrication" | "handover",
    cat: DocumentCategory
  ) {
    setError("");
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("sampleKind", sampleKind);
      fd.append("category", cat);
      const res = await fetch("/api/templates", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate sample template.");
        return;
      }
      router.push(`/templates/${data.template.id}`);
    } catch {
      setError("Network error generating sample.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            PDF Templates &amp; Field Builder
          </h1>
          <p className="text-sm text-slate-500">
            Upload your BOQs, CAD fabrication drawings, or contracts and place drag-and-drop signature fields.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upload Custom PDF */}
        <form
          onSubmit={handleUpload}
          className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs"
        >
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Upload className="w-5 h-5 text-orange-700" />
            <span>Upload New PDF Template</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kerala Tile Roofing BOQ"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Roofing Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-600"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="block border-2 border-dashed border-slate-300 hover:border-orange-600 rounded-xl p-5 text-center cursor-pointer bg-slate-50 transition">
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f) {
                  const lower = f.name.toLowerCase();
                  if (/policy|attendance|hr|employee|offer|appointment/.test(lower)) {
                    setCategory("HR_EMPLOYEE");
                  } else if (/drawing|truss|fab|dwg|structural/.test(lower)) {
                    setCategory("FABRICATION_DRAWING");
                  } else if (/handover|warranty|completion/.test(lower)) {
                    setCategory("HANDOVER_CERTIFICATE");
                  } else if (/work.?order|subcontract|vendor/.test(lower)) {
                    setCategory("WORK_ORDER");
                  } else if (/boq|quot|estimate|monier|ceramic|clay|upvc|tile/.test(lower)) {
                    setCategory("QUOTATION_BOQ");
                  }
                }
              }}
              className="hidden"
            />
            <FilePlus2 className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
            <div className="text-sm font-medium text-slate-700">
              {file
                ? file.name
                : "Click to choose a PDF, Word (.docx), or Excel (.xlsx, .xls, .csv)"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Word &amp; Excel files are automatically converted to PDF for signing
            </div>
          </label>

          <button
            type="submit"
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-orange-700 hover:bg-orange-800 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Upload &amp; Open Field Builder</span>
          </button>
        </form>

        {/* Quick Starter Templates */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Sparkles className="w-5 h-5 text-orange-700" />
            <span>Quick-Start Contract Templates</span>
          </div>
          <p className="text-xs text-slate-500">
            Need to test or start right away? Generate a ready-made commercial agreement PDF with pre-placed signature boxes.
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={creating}
              onClick={() => handleCreateSample("quotation", "QUOTATION_BOQ")}
              className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-orange-600 hover:bg-orange-50/40 transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Quotation &amp; BOQ Approval PDF
                </div>
                <div className="text-xs text-slate-500">
                  Clay/Concrete Tiles, Steel Truss &amp; Payment Terms
                </div>
              </div>
              <span className="text-xs font-semibold text-orange-700">
                Create →
              </span>
            </button>

            <button
              type="button"
              disabled={creating}
              onClick={() =>
                handleCreateSample("fabrication", "FABRICATION_DRAWING")
              }
              className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-orange-600 hover:bg-orange-50/40 transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Structural &amp; Truss Fabrication Drawing Sign-Off
                </div>
                <div className="text-xs text-slate-500">
                  Workshop cutting &amp; IS 4923 hollow steel specs approval
                </div>
              </div>
              <span className="text-xs font-semibold text-orange-700">
                Create →
              </span>
            </button>

            <button
              type="button"
              disabled={creating}
              onClick={() =>
                handleCreateSample("handover", "HANDOVER_CERTIFICATE")
              }
              className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-orange-600 hover:bg-orange-50/40 transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Site Measurement &amp; Project Handover Certificate
                </div>
                <div className="text-xs text-slate-500">
                  Final Sq.Ft. check, water test &amp; 10-year warranty start
                </div>
              </div>
              <span className="text-xs font-semibold text-orange-700">
                Create →
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Existing Templates */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 font-semibold text-slate-900">
          Saved Templates ({templates.length})
        </div>

        {templates.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No templates yet. Upload a PDF or click one of the Quick-Start templates above.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {templates.map((t) => (
              <div
                key={t.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div>
                  <div className="font-semibold text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-3 mt-1">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      {CATEGORY_LABELS[t.category as DocumentCategory] ||
                        t.category}
                    </span>
                    <span>{t.pageCount} page(s)</span>
                    <span>{t.fieldsCount} field(s)</span>
                    <span>Used in {t.requestsCount} request(s)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/templates/${t.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Edit Fields
                  </Link>
                  <Link
                    href={`/requests/new?templateId=${t.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-xs font-semibold"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </Link>
                  <button
                    onClick={() => handleDelete(t.id)}
                    title="Delete template"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

