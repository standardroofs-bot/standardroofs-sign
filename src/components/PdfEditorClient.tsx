"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileEdit, Upload, Download, FilePlus2, Loader2 } from "lucide-react";

export default function PdfEditorClient() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("Merged-Document");
  const [removePages, setRemovePages] = useState("");
  const [headerNote, setHeaderNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleRun(saveAsTemplate: boolean) {
    if (files.length === 0) {
      setError("Upload one or more PDF files first.");
      return;
    }
    setError("");
    setProcessing(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("name", name);
      fd.append("removePages", removePages);
      fd.append("headerNote", headerNote);
      fd.append("saveAsTemplate", saveAsTemplate ? "true" : "false");

      const res = await fetch("/api/pdf-editor", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to edit PDF.");
        return;
      }

      if (saveAsTemplate) {
        const json = await res.json();
        router.push(`/templates/${json.templateId}`);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name || "edited"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-800 border border-red-200 flex items-center justify-center">
          <FileEdit className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            PDF Editor &amp; Merger (Optional)
          </h1>
          <p className="text-xs text-slate-500">
            Combine multiple PDFs, remove unwanted pages, add a header note, and send directly for signature.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        <label className="block border-2 border-dashed border-slate-300 hover:border-red-700 rounded-xl p-6 text-center cursor-pointer bg-slate-50">
          <input
            type="file"
            multiple
            accept="application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="hidden"
          />
          <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <div className="text-sm font-semibold text-slate-700">
            {files.length > 0
              ? `${files.length} PDF(s) selected: ${files.map((f) => f.name).join(", ")}`
              : "Click to select 1 or more PDFs to edit / merge"}
          </div>
        </label>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Output Document Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Remove Pages (optional, e.g. 2, 4)
            </label>
            <input
              type="text"
              placeholder="e.g. 2, 4"
              value={removePages}
              onChange={(e) => setRemovePages(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Add Header Stamp / Note on Every Page (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. CONFIDENTIAL — STANDARD ROOFS APPROVAL COPY"
            value={headerNote}
            onChange={(e) => setHeaderNote(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={processing}
            onClick={() => handleRun(false)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold cursor-pointer"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download Edited PDF</span>
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={() => handleRun(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-900 text-white text-sm font-semibold cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Save &amp; Place Signatures</span>
          </button>
        </div>
      </div>
    </div>
  );
}

