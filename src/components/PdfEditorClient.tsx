"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SignaturePadModal from "./SignaturePadModal";
import {
  Upload,
  Download,
  FilePlus2,
  Trash2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Type,
  Eraser,
  PenTool,
  Stamp,
  Highlighter,
  MousePointer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Undo2,
  X,
  FileText,
  FileEdit,
  Eye,
  RefreshCw,
  ShieldCheck,
  Check,
} from "lucide-react";

export type EditorTool =
  | "select"
  | "whiteout"
  | "text"
  | "signature"
  | "stamp"
  | "highlight";

export interface EditorElement {
  id: string;
  pageNumber: number; // 1-based
  type: "whiteout" | "text" | "stamp" | "signature" | "highlight";
  normX: number; // 0..1
  normY: number; // 0..1
  normW: number; // 0..1
  normH: number; // 0..1
  text?: string;
  fontSize?: number;
  fontFamily?: "Helvetica" | "Times" | "Courier";
  color?: string;
  isBold?: boolean;
  isItalic?: boolean;
  dataUrl?: string;
  stampText?: string;
  stampColor?: string;
}

interface RenderedPage {
  pageNumber: number;
  width: number;
  height: number;
  dataUrl: string;
}

const STAMP_PRESETS = [
  { text: "APPROVED", color: "#16a34a" },
  { text: "CONFIDENTIAL", color: "#dc2626" },
  { text: "VERIFIED", color: "#2563eb" },
  { text: "REVISED", color: "#d97706" },
  { text: "COMPLETED", color: "#0f766e" },
  { text: "VOID", color: "#64748b" },
];

const COLOR_SWATCHES = [
  "#000000",
  "#334155",
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#d97706",
];

const FONT_SIZES = [10, 12, 14, 16, 18, 22, 28, 36];

export default function PdfEditorClient() {
  const router = useRouter();

  // File & Rendering State
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("Edited_Document");
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Active Tool & Selection State
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Text Tool Styling State
  const [textColor, setTextColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState<"Helvetica" | "Times" | "Courier">("Helvetica");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  // Stamp Tool State
  const [stampText, setStampText] = useState("APPROVED");
  const [stampColor, setStampColor] = useState("#16a34a");

  // Signature Modal State
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [preparedSigDataUrl, setPreparedSigDataUrl] = useState<string | null>(null);

  // Page Operations State
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [zoomScale, setZoomScale] = useState(1.0);

  // Action status
  const [exporting, setExporting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Dragging / Resizing State
  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origNormX: number;
    origNormY: number;
    origNormW: number;
    origNormH: number;
    containerW: number;
    containerH: number;
    hasMoved: boolean;
  } | null>(null);

  // Canvas Drawing for creating new Whiteout/Highlight
  const drawNewRef = useRef<{
    pageNumber: number;
    tool: EditorTool;
    startX: number;
    startY: number;
    rectW: number;
    rectH: number;
    tempId: string;
  } | null>(null);

  // Load and Render PDF with pdfjs-dist
  const renderPdfFile = useCallback(async (selectedFile: File) => {
    try {
      setLoadingPdf(true);
      setPdfError(null);
      setElements([]);
      setDeletedPages([]);
      setRotations({});
      setSelectedElementId(null);

      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      });
      const pdf = await loadingTask.promise;

      const rendered: RenderedPage[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = 840;
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        rendered.push({
          pageNumber: i,
          width: canvas.width,
          height: canvas.height,
          dataUrl: canvas.toDataURL("image/png"),
        });
      }

      setPages(rendered);
      const baseName = selectedFile.name.replace(/\.pdf$/i, "");
      setDocName(`${baseName}_edited`);
    } catch (err) {
      console.error("PDF render error:", err);
      setPdfError("Could not open PDF. Ensure the file is not password-protected or corrupted.");
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      renderPdfFile(f);
    }
  }

  function handleDropFile(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      renderPdfFile(f);
    }
  }

  // Handle global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId) {
          e.preventDefault();
          setElements((prev) => prev.filter((el) => el.id !== selectedElementId));
          setSelectedElementId(null);
        }
      } else if (e.key === "Escape") {
        setSelectedElementId(null);
        setActiveTool("select");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedElementId]);

  // Global mouse move & up listeners for dragging/resizing
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragRef.current) return;
      const {
        id,
        mode,
        startX,
        startY,
        origNormX,
        origNormY,
        origNormW,
        origNormH,
        containerW,
        containerH,
      } = dragRef.current;

      const deltaX = (e.clientX - startX) / containerW;
      const deltaY = (e.clientY - startY) / containerH;

      if (Math.abs(deltaX) > 0.005 || Math.abs(deltaY) > 0.005) {
        dragRef.current.hasMoved = true;
      }

      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== id) return el;
          if (mode === "move") {
            const newX = Math.max(0, Math.min(1 - el.normW, origNormX + deltaX));
            const newY = Math.max(0, Math.min(1 - el.normH, origNormY + deltaY));
            return { ...el, normX: newX, normY: newY };
          } else {
            // resize
            const minW = 20 / containerW;
            const minH = 14 / containerH;
            const newW = Math.max(minW, Math.min(1 - origNormX, origNormW + deltaX));
            const newH = Math.max(minH, Math.min(1 - origNormY, origNormH + deltaY));
            return { ...el, normW: newW, normH: newH };
          }
        })
      );
    }

    function onPointerUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  // Page Click Handler for placing elements
  function handlePageClick(
    e: React.MouseEvent<HTMLDivElement>,
    pageNumber: number,
    containerW: number,
    containerH: number
  ) {
    if (activeTool === "select") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    const newId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (activeTool === "whiteout") {
      // Place default whiteout box
      const defaultW = Math.min(0.35, 1 - clickX);
      const defaultH = Math.min(0.045, 1 - clickY);
      const newElem: EditorElement = {
        id: newId,
        pageNumber,
        type: "whiteout",
        normX: Math.max(0, clickX - 0.02),
        normY: Math.max(0, clickY - 0.01),
        normW: defaultW,
        normH: defaultH,
      };
      setElements((prev) => [...prev, newElem]);
      setSelectedElementId(newId);
      setActiveTool("select");
    } else if (activeTool === "text") {
      // Place editable text box
      const defaultW = Math.min(0.32, 1 - clickX);
      const defaultH = Math.min(0.05, 1 - clickY);
      const newElem: EditorElement = {
        id: newId,
        pageNumber,
        type: "text",
        normX: clickX,
        normY: clickY,
        normW: defaultW,
        normH: defaultH,
        text: "Click or double click to type",
        fontSize,
        fontFamily,
        color: textColor,
        isBold,
        isItalic,
      };
      setElements((prev) => [...prev, newElem]);
      setSelectedElementId(newId);
      setActiveTool("select");
    } else if (activeTool === "stamp") {
      // Place stamp badge
      const defaultW = Math.min(0.24, 1 - clickX);
      const defaultH = Math.min(0.065, 1 - clickY);
      const newElem: EditorElement = {
        id: newId,
        pageNumber,
        type: "stamp",
        normX: clickX,
        normY: clickY,
        normW: defaultW,
        normH: defaultH,
        stampText,
        stampColor,
      };
      setElements((prev) => [...prev, newElem]);
      setSelectedElementId(newId);
      setActiveTool("select");
    } else if (activeTool === "signature") {
      if (preparedSigDataUrl) {
        // Place signature image
        const defaultW = Math.min(0.26, 1 - clickX);
        const defaultH = Math.min(0.09, 1 - clickY);
        const newElem: EditorElement = {
          id: newId,
          pageNumber,
          type: "signature",
          normX: clickX,
          normY: clickY,
          normW: defaultW,
          normH: defaultH,
          dataUrl: preparedSigDataUrl,
        };
        setElements((prev) => [...prev, newElem]);
        setSelectedElementId(newId);
        setActiveTool("select");
      } else {
        // Prompt to draw signature first
        setSigModalOpen(true);
      }
    } else if (activeTool === "highlight") {
      const defaultW = Math.min(0.3, 1 - clickX);
      const defaultH = Math.min(0.035, 1 - clickY);
      const newElem: EditorElement = {
        id: newId,
        pageNumber,
        type: "highlight",
        normX: clickX,
        normY: clickY,
        normW: defaultW,
        normH: defaultH,
        color: "#facc15",
      };
      setElements((prev) => [...prev, newElem]);
      setSelectedElementId(newId);
      setActiveTool("select");
    }
  }

  // Page Controls
  function toggleDeletePage(pageNum: number) {
    setDeletedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum]
    );
  }

  function rotatePage(pageNum: number) {
    setRotations((prev) => {
      const cur = prev[pageNum] || 0;
      return { ...prev, [pageNum]: (cur + 90) % 360 };
    });
  }

  // Export / Download or Save Template
  async function handleExport(saveAsTemplate = false) {
    if (!file) return;

    setErrorNotice(null);
    setSuccessNotice(null);
    setExporting(true);

    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("name", docName);
      formData.append("saveAsTemplate", saveAsTemplate ? "true" : "false");

      const editsPayload = {
        deletedPages,
        rotations,
        elements,
      };
      formData.append("edits", JSON.stringify(editsPayload));

      const res = await fetch("/api/pdf-editor", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to process edited PDF.");
      }

      if (saveAsTemplate) {
        const json = await res.json();
        setSuccessNotice("Template saved successfully! Opening signature builder...");
        setTimeout(() => {
          router.push(`/templates/${json.templateId}`);
        }, 800);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${docName.replace(/\.pdf$/i, "")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccessNotice("Edited PDF downloaded successfully!");
      }
    } catch (err: any) {
      console.error("Export error:", err);
      setErrorNotice(err.message || "Failed to save edited document.");
    } finally {
      setExporting(false);
    }
  }

  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;

  // Selected Element Updates
  function updateSelectedElement(patch: Partial<EditorElement>) {
    if (!selectedElementId) return;
    setElements((prev) =>
      prev.map((el) => (el.id === selectedElementId ? { ...el, ...patch } : el))
    );
  }

  // EMPTY STATE: Upload View
  if (!file || pages.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100/70 text-red-800 text-xs font-semibold uppercase tracking-wider">
            <FileEdit className="w-3.5 h-3.5" /> Full Visual PDF Editor
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Edit, Erase, Re-Type &amp; Sign Any PDF
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Upload any contract, invoice, or document. Erase unwanted text &amp; prices, type new clauses, stamp approvals, and download in vector clarity.
          </p>
        </div>

        {/* Dropzone Card */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropFile}
          className="bg-white border-2 border-dashed border-slate-300 hover:border-red-600 rounded-3xl p-10 text-center transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer relative"
        >
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />

          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mx-auto mb-4 border border-red-100">
            {loadingPdf ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-1">
            {loadingPdf ? "Opening & Rendering PDF..." : "Choose a PDF or Drag & Drop Here"}
          </h3>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
            Supports standard multi-page PDFs, scans, policies, and agreements up to 50MB.
          </p>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-800 hover:bg-red-900 text-white font-semibold text-sm shadow-sm transition"
          >
            <Upload className="w-4 h-4" /> Browse PDF File
          </button>
        </div>

        {pdfError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{pdfError}</span>
          </div>
        )}

        {/* Feature Highlights Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-2.5 font-bold">
              <Eraser className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Whiteout / Eraser</h4>
            <p className="text-xs text-slate-500">
              Draw clean opaque patches to delete outdated prices, clauses, or client names.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2.5 font-bold">
              <Type className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Type &amp; Replace</h4>
            <p className="text-xs text-slate-500">
              Type fresh replacement text directly over whited-out sections with custom fonts &amp; colors.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-700 flex items-center justify-center mb-2.5 font-bold">
              <Stamp className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Stamps &amp; Signatures</h4>
            <p className="text-xs text-slate-500">
              Place official APPROVED or CONFIDENTIAL stamps and draw or place signatures.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-2.5 font-bold">
              <RotateCw className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Delete &amp; Rotate</h4>
            <p className="text-xs text-slate-500">
              Delete unwanted pages with 1-click and rotate sideways scans upright.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE EDITOR VIEW
  return (
    <div className="space-y-4">
      {/* TOP HEADER CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Document Name & File info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-800 border border-red-200 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="font-bold text-sm text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-red-700 focus:outline-hidden px-1 py-0.5 rounded"
                title="Click to rename output file"
              />
              <span className="text-xs text-slate-400">.pdf</span>
            </div>
            <div className="text-xs text-slate-500">
              {pages.length} page(s) • {elements.length} edit(s)
              {deletedPages.length > 0 && ` • ${deletedPages.length} deleted`}
            </div>
          </div>
        </div>

        {/* Center: Tools selector strip */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTool("select")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTool === "select"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Select & Move placed items (Esc)"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Select</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("whiteout")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTool === "whiteout"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Erase/Whiteout text or numbers"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Whiteout</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("text")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTool === "text"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Click to add or re-type text"
          >
            <Type className="w-3.5 h-3.5" />
            <span>Re-Type</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTool("signature");
              if (!preparedSigDataUrl) setSigModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTool === "signature"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Place Drawn/Typed Signature"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Signature</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("stamp")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTool === "stamp"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Place Approval or Confidential Stamp"
          >
            <Stamp className="w-3.5 h-3.5" />
            <span>Stamp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("highlight")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTool === "highlight"
                ? "bg-yellow-500 text-slate-950 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Yellow Highlight Marker"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>Highlight</span>
          </button>
        </div>

        {/* Right: Zoom & Export Action buttons */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.65, z - 0.15))}
              className="p-1 hover:text-slate-900 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(1.4, z + 0.15))}
              className="p-1 hover:text-slate-900 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download Edited PDF */}
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport(false)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download PDF</span>
          </button>

          {/* Save & Send for Signature */}
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-800 hover:bg-red-900 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Send for e-Sign</span>
          </button>

          {/* Change File */}
          <label
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="Replace PDF File"
          >
            <RefreshCw className="w-4 h-4" />
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* NOTICES */}
      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorNotice && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CONTEXTUAL TOOL PROPERTIES BAR */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Tool Specific Configs */}
        {activeTool === "text" || (selectedElement && selectedElement.type === "text") ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Type className="w-3.5 h-3.5 text-blue-600" /> Text Style:
            </span>

            {/* Font Family */}
            <select
              value={selectedElement ? selectedElement.fontFamily || "Helvetica" : fontFamily}
              onChange={(e) => {
                const fam = e.target.value as "Helvetica" | "Times" | "Courier";
                setFontFamily(fam);
                if (selectedElement) updateSelectedElement({ fontFamily: fam });
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium"
            >
              <option value="Helvetica">Helvetica (Sans)</option>
              <option value="Times">Times Roman (Serif)</option>
              <option value="Courier">Courier (Mono)</option>
            </select>

            {/* Font Size */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
              {FONT_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    setFontSize(sz);
                    if (selectedElement) updateSelectedElement({ fontSize: sz });
                  }}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                    (selectedElement ? selectedElement.fontSize === sz : fontSize === sz)
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            {/* Bold & Italic */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => {
                  const val = selectedElement ? !selectedElement.isBold : !isBold;
                  setIsBold(val);
                  if (selectedElement) updateSelectedElement({ isBold: val });
                }}
                className={`w-6 h-6 flex items-center justify-center rounded font-bold cursor-pointer ${
                  (selectedElement ? selectedElement.isBold : isBold)
                    ? "bg-slate-800 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                B
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = selectedElement ? !selectedElement.isItalic : !isItalic;
                  setIsItalic(val);
                  if (selectedElement) updateSelectedElement({ isItalic: val });
                }}
                className={`w-6 h-6 flex items-center justify-center rounded italic font-serif cursor-pointer ${
                  (selectedElement ? selectedElement.isItalic : isItalic)
                    ? "bg-slate-800 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                I
              </button>
            </div>

            {/* Color Swatches */}
            <div className="flex items-center gap-1.5">
              {COLOR_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    setTextColor(hex);
                    if (selectedElement) updateSelectedElement({ color: hex });
                  }}
                  className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs transition transform hover:scale-110 cursor-pointer relative"
                  style={{ backgroundColor: hex }}
                >
                  {(selectedElement ? selectedElement.color === hex : textColor === hex) && (
                    <Check className="w-3 h-3 text-white absolute inset-0 m-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : activeTool === "stamp" || (selectedElement && selectedElement.type === "stamp") ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Stamp className="w-3.5 h-3.5 text-purple-600" /> Stamp Type:
            </span>
            <div className="flex items-center gap-1.5">
              {STAMP_PRESETS.map((pst) => (
                <button
                  key={pst.text}
                  type="button"
                  onClick={() => {
                    setStampText(pst.text);
                    setStampColor(pst.color);
                    if (selectedElement) {
                      updateSelectedElement({
                        stampText: pst.text,
                        stampColor: pst.color,
                      });
                    }
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold border transition cursor-pointer"
                  style={{
                    borderColor: pst.color,
                    color: pst.color,
                    backgroundColor:
                      (selectedElement ? selectedElement.stampText === pst.text : stampText === pst.text)
                        ? `${pst.color}15`
                        : "transparent",
                  }}
                >
                  {pst.text}
                </button>
              ))}
            </div>
          </div>
        ) : activeTool === "whiteout" || (selectedElement && selectedElement.type === "whiteout") ? (
          <div className="flex items-center gap-2 text-slate-600">
            <Eraser className="w-4 h-4 text-amber-600" />
            <span className="font-medium">
              Click anywhere on a page to place an opaque whiteout box. Drag handles to cover outdated prices or clauses.
            </span>
          </div>
        ) : activeTool === "signature" ? (
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <PenTool className="w-3.5 h-3.5 text-emerald-600" /> Signature Mode:
            </span>
            <button
              type="button"
              onClick={() => setSigModalOpen(true)}
              className="px-3 py-1 bg-white border border-slate-300 rounded-lg hover:border-emerald-600 text-slate-800 font-semibold cursor-pointer"
            >
              {preparedSigDataUrl ? "Redraw Signature" : "Draw / Type Signature"}
            </button>
            <span className="text-slate-500">
              {preparedSigDataUrl ? "Click anywhere on the document to place your signature." : "Click above to draw or type your signature first."}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <MousePointer className="w-4 h-4" />
            <span>Click any placed element to move, resize, or delete. Select a tool above to add new edits.</span>
          </div>
        )}

        {/* Delete Selected Element Button */}
        {selectedElement && (
          <button
            type="button"
            onClick={() => {
              setElements((prev) => prev.filter((el) => el.id !== selectedElementId));
              setSelectedElementId(null);
            }}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold transition cursor-pointer ml-auto"
            title="Delete Selected Item (Delete/Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Selected</span>
          </button>
        )}
      </div>

      {/* WORKSPACE: LEFT THUMBNAILS + CENTER CANVAS VIEW */}
      <div className="flex gap-6 items-start">
        {/* Left Sidebar: Page Thumbnails & Operations */}
        <div className="w-52 shrink-0 space-y-4 bg-white border border-slate-200 rounded-2xl p-3 shadow-xs max-h-[85vh] overflow-y-auto sticky top-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Pages ({pages.length})
          </div>

          <div className="space-y-3">
            {pages.map((p) => {
              const isDeleted = deletedPages.includes(p.pageNumber);
              const rotation = rotations[p.pageNumber] || 0;

              return (
                <div
                  key={p.pageNumber}
                  className={`group relative border rounded-xl p-2 transition ${
                    isDeleted
                      ? "bg-slate-100 border-slate-300 opacity-60"
                      : "bg-slate-50 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {/* Thumbnail Image */}
                  <div
                    className="overflow-hidden rounded-md bg-white shadow-2xs aspect-[1/1.41] cursor-pointer flex items-center justify-center relative"
                    onClick={() => {
                      const el = document.getElementById(`editor-page-${p.pageNumber}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.dataUrl}
                      alt={`Page ${p.pageNumber}`}
                      className="w-full h-full object-contain transition-transform duration-200"
                      style={{ transform: `rotate(${rotation}deg)` }}
                    />

                    {isDeleted && (
                      <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-white">
                        <Trash2 className="w-6 h-6 text-red-400 mb-1" />
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-700 px-2 py-0.5 rounded">
                          Deleted
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail Controls Strip */}
                  <div className="flex items-center justify-between pt-1.5 px-0.5 text-xs">
                    <span className="font-semibold text-slate-700">Page {p.pageNumber}</span>

                    <div className="flex items-center gap-1">
                      {/* Rotate Button */}
                      <button
                        type="button"
                        onClick={() => rotatePage(p.pageNumber)}
                        disabled={isDeleted}
                        className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-200 transition cursor-pointer"
                        title="Rotate Page 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete / Restore Button */}
                      <button
                        type="button"
                        onClick={() => toggleDeletePage(p.pageNumber)}
                        className={`p-1 rounded transition cursor-pointer ${
                          isDeleted
                            ? "text-emerald-700 hover:bg-emerald-100"
                            : "text-slate-400 hover:text-red-700 hover:bg-red-50"
                        }`}
                        title={isDeleted ? "Restore Page" : "Delete Page"}
                      >
                        {isDeleted ? (
                          <Undo2 className="w-3.5 h-3.5" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Canvas Viewport */}
        <div className="flex-1 space-y-8 flex flex-col items-center pb-20">
          {pages.map((p) => {
            const isDeleted = deletedPages.includes(p.pageNumber);
            const rotation = rotations[p.pageNumber] || 0;
            const pageElements = elements.filter((el) => el.pageNumber === p.pageNumber);

            return (
              <div
                key={p.pageNumber}
                id={`editor-page-${p.pageNumber}`}
                className={`relative flex flex-col items-center transition ${
                  isDeleted ? "opacity-40 grayscale pointer-events-none" : ""
                }`}
                style={{
                  width: `${Math.round(840 * zoomScale)}px`,
                }}
              >
                {/* Page Number Header */}
                <div className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 mb-2 px-1">
                  <span>
                    PAGE {p.pageNumber} OF {pages.length}
                    {rotation > 0 && ` • Rotated ${rotation}°`}
                  </span>
                  {isDeleted && (
                    <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      Marked for Deletion
                    </span>
                  )}
                </div>

                {/* Interactive Page Container */}
                <div
                  className="relative bg-white shadow-xl border border-slate-300 rounded-md overflow-hidden select-none w-full"
                  style={{
                    aspectRatio: `${p.width} / ${p.height}`,
                    transform: `rotate(${rotation}deg)`,
                    transition: "transform 0.2s ease-in-out",
                  }}
                  onClick={(e) => handlePageClick(e, p.pageNumber, p.width, p.height)}
                >
                  {/* Base PDF Background */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt={`Page ${p.pageNumber}`}
                    className="w-full h-full block pointer-events-none"
                    draggable={false}
                  />

                  {/* Visual Edits Overlay */}
                  <div className="absolute inset-0">
                    {pageElements.map((elem) => {
                      const isSelected = elem.id === selectedElementId;

                      return (
                        <div
                          key={elem.id}
                          className={`absolute group cursor-move ${
                            isSelected
                              ? "ring-2 ring-blue-600 ring-offset-1 z-30"
                              : "hover:ring-1 hover:ring-blue-400 z-10"
                          }`}
                          style={{
                            left: `${elem.normX * 100}%`,
                            top: `${elem.normY * 100}%`,
                            width: `${elem.normW * 100}%`,
                            height: `${elem.normH * 100}%`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedElementId(elem.id);
                          }}
                          onPointerDown={(e) => {
                            if (activeTool !== "select") return;
                            e.stopPropagation();
                            const container = e.currentTarget.parentElement;
                            if (!container) return;
                            const rect = container.getBoundingClientRect();
                            dragRef.current = {
                              id: elem.id,
                              mode: "move",
                              startX: e.clientX,
                              startY: e.clientY,
                              origNormX: elem.normX,
                              origNormY: elem.normY,
                              origNormW: elem.normW,
                              origNormH: elem.normH,
                              containerW: rect.width,
                              containerH: rect.height,
                              hasMoved: false,
                            };
                          }}
                        >
                          {/* ELEMENT TYPE CONTENT RENDERING */}
                          {elem.type === "whiteout" ? (
                            <div className="w-full h-full bg-white border border-dashed border-slate-300 group-hover:border-slate-500 shadow-2xs flex items-center justify-center text-[10px] text-slate-400 select-none">
                              {isSelected && <span className="opacity-60 font-mono">Eraser</span>}
                            </div>
                          ) : elem.type === "highlight" ? (
                            <div
                              className="w-full h-full opacity-40 rounded-xs"
                              style={{ backgroundColor: elem.color || "#facc15" }}
                            />
                          ) : elem.type === "text" ? (
                            <div
                              className="w-full h-full p-1 overflow-hidden flex items-start"
                              style={{
                                color: elem.color || "#000000",
                                fontSize: `${(elem.fontSize || 14) * zoomScale}px`,
                                fontFamily:
                                  elem.fontFamily === "Times"
                                    ? "'Times New Roman', serif"
                                    : elem.fontFamily === "Courier"
                                    ? "Courier, monospace"
                                    : "Helvetica, Arial, sans-serif",
                                fontWeight: elem.isBold ? "bold" : "normal",
                                fontStyle: elem.isItalic ? "italic" : "normal",
                                lineHeight: "1.25",
                              }}
                            >
                              <textarea
                                value={elem.text || ""}
                                onChange={(e) => {
                                  updateSelectedElement({ text: e.target.value });
                                }}
                                onFocus={() => setSelectedElementId(elem.id)}
                                className="w-full h-full bg-transparent resize-none border-none outline-hidden p-0 m-0"
                                placeholder="Type text..."
                              />
                            </div>
                          ) : elem.type === "stamp" ? (
                            <div
                              className="w-full h-full rounded-md border-2 bg-white/95 flex items-center justify-center font-black uppercase tracking-wider text-center px-1 shadow-2xs select-none"
                              style={{
                                borderColor: elem.stampColor || "#16a34a",
                                color: elem.stampColor || "#16a34a",
                                fontSize: `${Math.max(10, Math.min(22, 14 * zoomScale))}px`,
                              }}
                            >
                              {elem.stampText || "APPROVED"}
                            </div>
                          ) : elem.type === "signature" && elem.dataUrl ? (
                            <div className="w-full h-full flex items-center justify-center bg-white/40">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={elem.dataUrl}
                                alt="Signature"
                                className="w-full h-full object-contain pointer-events-none"
                              />
                            </div>
                          ) : null}

                          {/* RESIZE HANDLE (Bottom-Right) */}
                          {isSelected && (
                            <div
                              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white shadow-xs cursor-nwse-resize z-40"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                const container = e.currentTarget.parentElement?.parentElement;
                                if (!container) return;
                                const rect = container.getBoundingClientRect();
                                dragRef.current = {
                                  id: elem.id,
                                  mode: "resize",
                                  startX: e.clientX,
                                  startY: e.clientY,
                                  origNormX: elem.normX,
                                  origNormY: elem.normY,
                                  origNormW: elem.normW,
                                  origNormH: elem.normH,
                                  containerW: rect.width,
                                  containerH: rect.height,
                                  hasMoved: false,
                                };
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SIGNATURE PAD MODAL FOR SIGNATURE TOOL */}
      <SignaturePadModal
        isOpen={sigModalOpen}
        title="Create Signature to Place"
        onClose={() => setSigModalOpen(false)}
        onSave={(dataUrl) => {
          setPreparedSigDataUrl(dataUrl);
          setSigModalOpen(false);
          setActiveTool("signature");
          setSuccessNotice("Signature captured! Click anywhere on the document to place it.");
        }}
      />
    </div>
  );
}
