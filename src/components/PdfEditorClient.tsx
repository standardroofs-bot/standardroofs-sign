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
  Redo2,
  X,
  FileText,
  FileEdit,
  RefreshCw,
  Check,
  Plus,
  Sparkles,
  Edit3,
  Palette,
} from "lucide-react";

export type EditorTool =
  | "edit-text"
  | "add-text"
  | "whiteout"
  | "signature"
  | "stamp"
  | "highlight";

export interface EditableTextLine {
  id: string;
  pageNumber: number;
  originalText: string;
  currentText: string;
  isEdited: boolean;
  isDeleted: boolean;
  fontSize: number; // raw PDF points
  scale: number; // canvas viewport scale factor (e.g. 1.411)
  fontFamily: "Helvetica" | "Times" | "Courier";
  color: string;
  isBold: boolean;
  isItalic: boolean;
  normX: number; // 0..1
  normY: number; // 0..1
  normW: number; // 0..1
  normH: number; // 0..1
}

export interface CustomElement {
  id: string;
  pageNumber: number;
  type: "whiteout" | "text" | "stamp" | "signature" | "highlight";
  normX: number;
  normY: number;
  normW: number;
  normH: number;
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
  "#881337", // Maroon / Deep Red
  "#dc2626", // Red
  "#1e3a8a", // Navy Blue
  "#2563eb", // Blue
  "#15803d", // Green
  "#475569", // Slate
];

// Sample rendered canvas to detect exact pixel color and bold weight
function sampleLineStyle(
  ctx: CanvasRenderingContext2D,
  pixelX: number,
  pixelY: number,
  pixelW: number,
  pixelH: number,
  fontName?: string
): { color: string; isBold: boolean } {
  const fnLower = (fontName || "").toLowerCase();
  let isBold =
    fnLower.includes("bold") ||
    fnLower.includes("black") ||
    fnLower.includes("heavy") ||
    fnLower.endsWith("_f3") ||
    fnLower.includes("f3");

  let detectedColor = "#0f172a";

  try {
    const sampleW = Math.max(8, Math.min(Math.floor(pixelW), 250));
    const sampleH = Math.max(6, Math.min(Math.floor(pixelH), 50));
    const startX = Math.max(0, Math.floor(pixelX));
    const startY = Math.max(0, Math.floor(pixelY));

    const imgData = ctx.getImageData(startX, startY, sampleW, sampleH);
    const data = imgData.data;

    let darkCount = 0;
    let coloredCount = 0;
    let sumR = 0, sumG = 0, sumB = 0;
    let colR = 0, colG = 0, colB = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip transparent or near-white background
      if (a < 50 || (r > 235 && g > 235 && b > 235)) continue;

      darkCount++;
      sumR += r;
      sumG += g;
      sumB += b;

      // Chromatic color detection (e.g. Maroon red, Dark blue)
      const maxVal = Math.max(r, g, b);
      const minVal = Math.min(r, g, b);
      if (maxVal - minVal > 22) {
        coloredCount++;
        colR += r;
        colG += g;
        colB += b;
      }
    }

    if (coloredCount > 8) {
      const avgR = Math.round(colR / coloredCount);
      const avgG = Math.round(colG / coloredCount);
      const avgB = Math.round(colB / coloredCount);
      detectedColor = `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1)}`;
    } else if (darkCount > 0) {
      const avgR = Math.round(sumR / darkCount);
      const avgG = Math.round(sumG / darkCount);
      const avgB = Math.round(sumB / darkCount);
      detectedColor = `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1)}`;
    }

    // Density check for bold
    const density = darkCount / (sampleW * sampleH);
    if (density > 0.16) {
      isBold = true;
    }
  } catch (e) {
    // fallback
  }

  return { color: detectedColor, isBold };
}

export default function PdfEditorClient() {
  const router = useRouter();

  // File & Page Rendering State
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("Edited_Document");
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Extracted Original Text Lines (Word-Style In-Place Text Editing)
  const [textLines, setTextLines] = useState<EditableTextLine[]>([]);
  const [activeEditingLineId, setActiveEditingLineId] = useState<string | null>(null);

  // Custom User-Placed Elements (Whiteout boxes, new text, stamps, signatures)
  const [customElements, setCustomElements] = useState<CustomElement[]>([]);
  const [selectedCustomElemId, setSelectedCustomElemId] = useState<string | null>(null);

  // Active Tool Mode
  const [activeTool, setActiveTool] = useState<EditorTool>("edit-text");

  // Stamp Tool State
  const [stampText, setStampText] = useState("APPROVED");
  const [stampColor, setStampColor] = useState("#16a34a");

  // Signature Modal State
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [preparedSigDataUrl, setPreparedSigDataUrl] = useState<string | null>(null);

  // Page Operations & Zoom
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [zoomScale, setZoomScale] = useState(1.0);

  // Undo / Redo History Stack (Ctrl+Z)
  interface HistorySnapshot {
    textLines: EditableTextLine[];
    customElements: CustomElement[];
    deletedPages: number[];
    rotations: Record<number, number>;
  }
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Status & Notifications
  const [exporting, setExporting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Dragging / Resizing State for Custom Elements
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

  // Group extracted PDF text items and sample their exact colors and styles
  const groupTextIntoLines = (
    items: any[],
    pageW: number,
    pageH: number,
    pageNum: number,
    ctx: CanvasRenderingContext2D,
    scale: number
  ): EditableTextLine[] => {
    const valid = items.filter(
      (it) => typeof it.str === "string" && it.str.trim().length > 0 && it.transform
    );

    // Sort top-to-bottom, then left-to-right
    const sorted = [...valid].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 3.5) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    const rawLines: {
      text: string;
      x: number;
      y: number;
      w: number;
      h: number;
      fontSize: number;
      fontName: string;
    }[] = [];

    for (const it of sorted) {
      const itX = it.transform[4];
      const itY = it.transform[5];
      const itFs = Math.round(Math.hypot(it.transform[0], it.transform[1]) * 10) / 10 || 12;
      const itH = it.height || itFs;
      const itW = it.width || it.str.length * itFs * 0.55;

      const last = rawLines[rawLines.length - 1];
      if (
        last &&
        Math.abs(last.y - itY) <= 4.5 &&
        itX >= last.x - 4 &&
        itX <= last.x + last.w + itFs * 2.2
      ) {
        const spaceNeeded =
          !last.text.endsWith(" ") && !it.str.startsWith(" ") ? " " : "";
        last.text += spaceNeeded + it.str;
        last.w = itX + itW - last.x;
        last.h = Math.max(last.h, itH);
      } else {
        rawLines.push({
          text: it.str,
          x: itX,
          y: itY,
          w: itW,
          h: itH,
          fontSize: itFs,
          fontName: it.fontName || "",
        });
      }
    }

    return rawLines.map((l, idx) => {
      // Sample style from canvas pixels
      const pixelX = (l.x - 2) * scale;
      const pixelY = (pageH - (l.y + l.h * 1.05)) * scale;
      const pixelW = (l.w + 6) * scale;
      const pixelH = (l.h * 1.25) * scale;
      const sampled = sampleLineStyle(ctx, pixelX, pixelY, pixelW, pixelH, l.fontName);

      // Intelligent bold detection for headers, section titles, and key labels
      const trimmed = l.text.trim();
      const isAllUpper = trimmed.length >= 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
      const isNumberedHeader = /^\d+\.\s+[A-Z]/.test(trimmed);
      const isKeyLabel = trimmed.endsWith(":") || /^[A-Z][a-zA-Z\s]+:/.test(trimmed);
      const detectedBold = sampled.isBold || isNumberedHeader || isAllUpper || isKeyLabel;

      return {
        id: `p${pageNum}_line_${idx}`,
        pageNumber: pageNum,
        originalText: l.text,
        currentText: l.text,
        isEdited: false,
        isDeleted: false,
        fontSize: Math.max(8, Math.min(48, l.fontSize)),
        scale: Math.round(scale * 1000) / 1000,
        fontFamily: "Helvetica",
        color: sampled.color,
        isBold: detectedBold,
        isItalic: false,
        normX: Math.max(0, (l.x - 2) / pageW),
        normY: Math.max(0, (pageH - (l.y + l.h * 1.05)) / pageH),
        normW: Math.min(1, (l.w + 6) / pageW),
        normH: Math.min(1, (l.h * 1.28) / pageH),
      };
    });
  };

  // Load and Render PDF with pdfjs-dist & extract text + styles
  const renderPdfFile = useCallback(async (selectedFile: File) => {
    try {
      setLoadingPdf(true);
      setPdfError(null);
      setTextLines([]);
      setCustomElements([]);
      setDeletedPages([]);
      setRotations({});
      setActiveEditingLineId(null);
      setSelectedCustomElemId(null);

      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      });
      const pdf = await loadingTask.promise;

      const rendered: RenderedPage[] = [];
      const extractedLines: EditableTextLine[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = 840;
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        // 1. Render visual canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

        // 2. Extract text items & sample exact font styles & colors
        try {
          const textContent = await page.getTextContent();
          const pageLines = groupTextIntoLines(
            textContent.items,
            baseViewport.width,
            baseViewport.height,
            i,
            ctx,
            scale
          );
          extractedLines.push(...pageLines);
        } catch (textErr) {
          console.warn(`Could not extract text from page ${i}:`, textErr);
        }
      }

      setPages(rendered);
      setTextLines(extractedLines);
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

  // Save snapshot before any state modification for Undo (Ctrl+Z)
  const saveHistorySnapshot = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-30),
      {
        textLines: textLines.map((l) => ({ ...l })),
        customElements: customElements.map((el) => ({ ...el })),
        deletedPages: [...deletedPages],
        rotations: { ...rotations },
      },
    ]);
    setRedoStack([]);
  }, [textLines, customElements, deletedPages, rotations]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack((prev) => [
      ...prev,
      {
        textLines: textLines.map((l) => ({ ...l })),
        customElements: customElements.map((el) => ({ ...el })),
        deletedPages: [...deletedPages],
        rotations: { ...rotations },
      },
    ]);

    setUndoStack(newUndoStack);
    setTextLines(previous.textLines);
    setCustomElements(previous.customElements);
    setDeletedPages(previous.deletedPages);
    setRotations(previous.rotations);
    setActiveEditingLineId(null);
    setSelectedCustomElemId(null);
  }, [undoStack, textLines, customElements, deletedPages, rotations]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack((prev) => [
      ...prev,
      {
        textLines: textLines.map((l) => ({ ...l })),
        customElements: customElements.map((el) => ({ ...el })),
        deletedPages: [...deletedPages],
        rotations: { ...rotations },
      },
    ]);

    setRedoStack(newRedoStack);
    setTextLines(next.textLines);
    setCustomElements(next.customElements);
    setDeletedPages(next.deletedPages);
    setRotations(next.rotations);
    setActiveEditingLineId(null);
    setSelectedCustomElemId(null);
  }, [redoStack, textLines, customElements, deletedPages, rotations]);

  // Keyboard shortcuts (including Ctrl+Z and Ctrl+Y)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (!isInput) {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (isInput) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedCustomElemId) {
          e.preventDefault();
          saveHistorySnapshot();
          setCustomElements((prev) => prev.filter((el) => el.id !== selectedCustomElemId));
          setSelectedCustomElemId(null);
        } else if (activeEditingLineId) {
          e.preventDefault();
          deleteTextLine(activeEditingLineId);
        }
      } else if (e.key === "Escape") {
        setActiveEditingLineId(null);
        setSelectedCustomElemId(null);
        setActiveTool("edit-text");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCustomElemId, activeEditingLineId, handleUndo, handleRedo, saveHistorySnapshot]);

  // Pointer move & up listeners for custom elements
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

      setCustomElements((prev) =>
        prev.map((el) => {
          if (el.id !== id) return el;
          if (mode === "move") {
            const newX = Math.max(0, Math.min(1 - el.normW, origNormX + deltaX));
            const newY = Math.max(0, Math.min(1 - el.normH, origNormY + deltaY));
            return { ...el, normX: newX, normY: newY };
          } else {
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

  function updateTextLine(lineId: string, patch: Partial<EditableTextLine>) {
    setTextLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, ...patch, isEdited: true } : l))
    );
  }

  function deleteTextLine(lineId: string) {
    saveHistorySnapshot();
    setTextLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, isDeleted: true, isEdited: true } : l))
    );
    if (activeEditingLineId === lineId) {
      setActiveEditingLineId(null);
    }
  }

  function restoreTextLine(lineId: string) {
    saveHistorySnapshot();
    setTextLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              isDeleted: false,
              currentText: l.originalText,
              isEdited: false,
            }
          : l
      )
    );
  }

  function handlePageCanvasClick(
    e: React.MouseEvent<HTMLDivElement>,
    pageNumber: number
  ) {
    if (activeTool === "edit-text") {
      setActiveEditingLineId(null);
      setSelectedCustomElemId(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;
    const newId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    saveHistorySnapshot();

    if (activeTool === "add-text") {
      const newElem: CustomElement = {
        id: newId,
        pageNumber,
        type: "text",
        normX: clickX,
        normY: clickY,
        normW: Math.min(0.35, 1 - clickX),
        normH: 0.05,
        text: "New text...",
        fontSize: 14,
        fontFamily: "Helvetica",
        color: "#0f172a",
        isBold: false,
        isItalic: false,
      };
      setCustomElements((prev) => [...prev, newElem]);
      setSelectedCustomElemId(newId);
      setActiveTool("edit-text");
    } else if (activeTool === "whiteout") {
      const newElem: CustomElement = {
        id: newId,
        pageNumber,
        type: "whiteout",
        normX: clickX,
        normY: clickY,
        normW: Math.min(0.3, 1 - clickX),
        normH: 0.05,
      };
      setCustomElements((prev) => [...prev, newElem]);
      setSelectedCustomElemId(newId);
      setActiveTool("edit-text");
    } else if (activeTool === "stamp") {
      const newElem: CustomElement = {
        id: newId,
        pageNumber,
        type: "stamp",
        normX: clickX,
        normY: clickY,
        normW: Math.min(0.25, 1 - clickX),
        normH: 0.065,
        stampText,
        stampColor,
      };
      setCustomElements((prev) => [...prev, newElem]);
      setSelectedCustomElemId(newId);
      setActiveTool("edit-text");
    } else if (activeTool === "signature") {
      if (preparedSigDataUrl) {
        const newElem: CustomElement = {
          id: newId,
          pageNumber,
          type: "signature",
          normX: clickX,
          normY: clickY,
          normW: Math.min(0.26, 1 - clickX),
          normH: 0.09,
          dataUrl: preparedSigDataUrl,
        };
        setCustomElements((prev) => [...prev, newElem]);
        setSelectedCustomElemId(newId);
        setActiveTool("edit-text");
      } else {
        setSigModalOpen(true);
      }
    } else if (activeTool === "highlight") {
      const newElem: CustomElement = {
        id: newId,
        pageNumber,
        type: "highlight",
        normX: clickX,
        normY: clickY,
        normW: Math.min(0.32, 1 - clickX),
        normH: 0.035,
        color: "#facc15",
      };
      setCustomElements((prev) => [...prev, newElem]);
      setSelectedCustomElemId(newId);
      setActiveTool("edit-text");
    }
  }

  function toggleDeletePage(pageNum: number) {
    saveHistorySnapshot();
    setDeletedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum]
    );
  }

  function rotatePage(pageNum: number) {
    saveHistorySnapshot();
    setRotations((prev) => {
      const cur = prev[pageNum] || 0;
      return { ...prev, [pageNum]: (cur + 90) % 360 };
    });
  }

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

      const modifiedLines = textLines.filter((l) => l.isEdited || l.isDeleted);

      const editsPayload = {
        deletedPages,
        rotations,
        textEdits: modifiedLines.map((l) => ({
          pageNumber: l.pageNumber,
          normX: l.normX,
          normY: l.normY,
          normW: l.normW,
          normH: l.normH,
          originalText: l.originalText,
          newText: l.currentText,
          isDeleted: l.isDeleted,
          fontSize: l.fontSize,
          fontFamily: l.fontFamily,
          color: l.color,
          isBold: l.isBold,
          isItalic: l.isItalic,
        })),
        elements: customElements,
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
        setSuccessNotice("Edited PDF downloaded successfully with all text changes applied!");
      }
    } catch (err: any) {
      console.error("Export error:", err);
      setErrorNotice(err.message || "Failed to save edited document.");
    } finally {
      setExporting(false);
    }
  }

  const activeLine = textLines.find((l) => l.id === activeEditingLineId) || null;
  const editedCount = textLines.filter((l) => l.isEdited && !l.isDeleted).length;
  const deletedCount = textLines.filter((l) => l.isDeleted).length;

  // EMPTY STATE: Upload View
  if (!file || pages.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100/70 text-red-800 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Word-Style Real PDF Editor
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Click Any Text in Your PDF to Edit or Remove It
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Just like Microsoft Word: upload any PDF, click on any sentence, price, or clause to edit words in place or remove entire lines.
          </p>
        </div>

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
            {loadingPdf ? "Detecting Text, Colors & Styles..." : "Choose a PDF or Drag & Drop Here"}
          </h3>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
            Loads document text into interactive editable blocks ready for real-time typing.
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

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2.5 font-bold">
              <Edit3 className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">1-Click In-Place Text Editing</h4>
            <p className="text-xs text-slate-500">
              Click any sentence or line in the PDF and start typing immediately with matching color, font-weight, and alignment.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-700 flex items-center justify-center mb-2.5 font-bold">
              <Trash2 className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Remove Lines &amp; Clauses</h4>
            <p className="text-xs text-slate-500">
              Click the trash icon or delete text to permanently erase lines or paragraphs like in Word.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5 font-bold">
              <Download className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Vector PDF Download</h4>
            <p className="text-xs text-slate-500">
              Exports clean, searchable vector PDF with zero blurriness or compression artifacts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE WORD-STYLE PDF EDITOR VIEW
  return (
    <div className="space-y-4">
      {/* TOP HEADER CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Document Name & Edit Counters */}
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
                title="Click to rename document"
              />
              <span className="text-xs text-slate-400">.pdf</span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>{pages.length} page(s)</span>
              {editedCount > 0 && (
                <span className="text-blue-700 font-semibold">• {editedCount} text edited</span>
              )}
              {deletedCount > 0 && (
                <span className="text-red-700 font-semibold">• {deletedCount} line(s) removed</span>
              )}
              {customElements.length > 0 && (
                <span className="text-purple-700 font-semibold">• {customElements.length} element(s)</span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Tools selector strip */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTool("edit-text")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTool === "edit-text"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Click any text in the document to edit or remove it (Word style)"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Click &amp; Edit Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("add-text")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTool === "add-text"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Click anywhere to add brand new text"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("whiteout")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTool === "whiteout"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Erase or whiteout any box/table/logo"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Whiteout</span>
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

        {/* Right: Undo/Redo, Zoom & Export Action buttons */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className={`p-1.5 rounded-lg flex items-center gap-1 transition ${
                undoStack.length > 0
                  ? "text-slate-800 hover:bg-white hover:shadow-xs cursor-pointer"
                  : "text-slate-300 cursor-not-allowed"
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Undo</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`p-1.5 rounded-lg flex items-center gap-1 transition ${
                redoStack.length > 0
                  ? "text-slate-800 hover:bg-white hover:shadow-xs cursor-pointer"
                  : "text-slate-300 cursor-not-allowed"
              }`}
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Redo</span>
            </button>
          </div>

          {/* Zoom */}
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
            <span>Download Edited PDF</span>
          </button>

          {/* Send for e-Sign */}
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-800 hover:bg-red-900 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Send for e-Sign</span>
          </button>

          {/* Replace PDF */}
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

      {/* ACTIVE LINE TYPOGRAPHIC TOOLBAR */}
      {activeLine && (
        <div className="bg-slate-900 text-white border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xl animate-in fade-in sticky top-2 z-50">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-blue-300 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-blue-400" />
              <span>Editing Line:</span>
            </span>

            {/* Font Family */}
            <select
              value={activeLine.fontFamily}
              onChange={(e) =>
                updateTextLine(activeLine.id, {
                  fontFamily: e.target.value as "Helvetica" | "Times" | "Courier",
                })
              }
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs"
            >
              <option value="Helvetica">Arial / Helvetica (Sans)</option>
              <option value="Times">Times Roman (Serif)</option>
              <option value="Courier">Courier (Mono)</option>
            </select>

            {/* Font Size (+ / - / direct input) */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() =>
                  updateTextLine(activeLine.id, {
                    fontSize: Math.max(7, Math.round((activeLine.fontSize - 0.5) * 10) / 10),
                  })
                }
                className="px-2 py-0.5 text-slate-300 hover:text-white font-bold cursor-pointer"
                title="Decrease font size"
              >
                -
              </button>
              <span className="px-1.5 font-bold text-white min-w-[36px] text-center">
                {activeLine.fontSize}pt
              </span>
              <button
                type="button"
                onClick={() =>
                  updateTextLine(activeLine.id, {
                    fontSize: Math.min(48, Math.round((activeLine.fontSize + 0.5) * 10) / 10),
                  })
                }
                className="px-2 py-0.5 text-slate-300 hover:text-white font-bold cursor-pointer"
                title="Increase font size"
              >
                +
              </button>
            </div>

            {/* Bold Toggle */}
            <button
              type="button"
              onClick={() =>
                updateTextLine(activeLine.id, { isBold: !activeLine.isBold })
              }
              className={`w-7 h-7 flex items-center justify-center rounded-lg font-black text-xs transition cursor-pointer ${
                activeLine.isBold
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              }`}
              title="Toggle Bold (B)"
            >
              B
            </button>

            {/* Italic Toggle */}
            <button
              type="button"
              onClick={() =>
                updateTextLine(activeLine.id, { isItalic: !activeLine.isItalic })
              }
              className={`w-7 h-7 flex items-center justify-center rounded-lg italic font-serif text-xs transition cursor-pointer ${
                activeLine.isItalic
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              }`}
              title="Toggle Italic (I)"
            >
              I
            </button>

            {/* Text Color Picker & Swatches */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Palette className="w-3 h-3" /> Color:
              </span>

              {/* Native Color Picker */}
              <input
                type="color"
                value={activeLine.color.length === 7 ? activeLine.color : "#000000"}
                onChange={(e) => updateTextLine(activeLine.id, { color: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                title="Choose custom color"
              />

              {/* Detected / Preset Swatches */}
              <div className="flex items-center gap-1 ml-1">
                {/* Active Color indicator pill if not in presets */}
                {!COLOR_SWATCHES.includes(activeLine.color) && (
                  <button
                    type="button"
                    onClick={() => updateTextLine(activeLine.id, { color: activeLine.color })}
                    className="w-4 h-4 rounded-full border-2 border-white shadow-xs relative"
                    style={{ backgroundColor: activeLine.color }}
                    title={`Detected Original Color (${activeLine.color})`}
                  />
                )}

                {COLOR_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => updateTextLine(activeLine.id, { color: hex })}
                    className="w-4 h-4 rounded-full border border-slate-600 cursor-pointer relative transition hover:scale-110"
                    style={{ backgroundColor: hex }}
                  >
                    {activeLine.color.toLowerCase() === hex.toLowerCase() && (
                      <Check className="w-2.5 h-2.5 text-white absolute inset-0 m-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons on the active line */}
          <div className="flex items-center gap-2">
            {activeLine.isEdited && (
              <button
                type="button"
                onClick={() => restoreTextLine(activeLine.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                title="Reset line to original PDF text"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => deleteTextLine(activeLine.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/70 hover:bg-red-800 text-red-200 text-xs font-semibold cursor-pointer"
              title="Delete this entire line from the PDF (Word-style erase)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Line</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEditingLineId(null)}
              className="flex items-center gap-1 px-3.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer ml-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      )}

      {/* WORKSPACE: LEFT THUMBNAILS + CENTER INTERACTIVE CANVAS */}
      <div className="flex gap-6 items-start">
        {/* Left Sidebar: Thumbnails */}
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

                  <div className="flex items-center justify-between pt-1.5 px-0.5 text-xs">
                    <span className="font-semibold text-slate-700">Page {p.pageNumber}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => rotatePage(p.pageNumber)}
                        disabled={isDeleted}
                        className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-200 transition cursor-pointer"
                        title="Rotate Page 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

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
            const pageLines = textLines.filter((l) => l.pageNumber === p.pageNumber);
            const pageCustomElems = customElements.filter((el) => el.pageNumber === p.pageNumber);

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
                {/* Page Header */}
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
                  onClick={(e) => handlePageCanvasClick(e, p.pageNumber)}
                >
                  {/* Base PDF Canvas Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt={`Page ${p.pageNumber}`}
                    className="w-full h-full block pointer-events-none"
                    draggable={false}
                  />

                  {/* 1. WORD-STYLE IN-PLACE TEXT EDITING LAYER */}
                  <div className="absolute inset-0 z-20">
                    {pageLines.map((line) => {
                      const isEditing = activeEditingLineId === line.id;

                      if (line.isDeleted) {
                        // Deleted Line: Render solid whiteout over original PDF text with a subtle strikeout
                        return (
                          <div
                            key={line.id}
                            className="absolute bg-white/95 border border-dashed border-red-300 flex items-center justify-between px-1.5 group cursor-pointer"
                            style={{
                              left: `${line.normX * 100}%`,
                              top: `${line.normY * 100}%`,
                              width: `${line.normW * 100}%`,
                              height: `${line.normH * 100}%`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              restoreTextLine(line.id);
                            }}
                            title="Line Removed. Click to restore original text."
                          >
                            <span className="text-[10px] text-red-500 line-through truncate font-mono opacity-60">
                              {line.originalText}
                            </span>
                            <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded font-bold ml-1 opacity-0 group-hover:opacity-100 transition">
                              Undo
                            </span>
                          </div>
                        );
                      }

                      if (isEditing) {
                        // Currently Active Editable Line: Exact baseline alignment, matching color, font-weight, auto-expanding width
                        return (
                          <div
                            key={line.id}
                            className="absolute bg-white shadow-md ring-2 ring-blue-600 rounded-xs flex items-center z-30"
                            style={{
                              left: `${line.normX * 100}%`,
                              top: `${line.normY * 100}%`,
                              minWidth: `${line.normW * 100}%`,
                              width: "max-content",
                              maxWidth: `${(1 - line.normX) * 100}%`,
                              height: `${line.normH * 100}%`,
                              padding: "0 2px",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={line.currentText}
                              autoFocus
                              onChange={(e) => {
                                updateTextLine(line.id, { currentText: e.target.value });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                  setActiveEditingLineId(null);
                                }
                              }}
                              style={{
                                color: line.color,
                                fontSize: `${Math.round(line.fontSize * (line.scale || 1.411) * zoomScale * 10) / 10}px`,
                                fontFamily:
                                  line.fontFamily === "Times"
                                    ? "'Times New Roman', serif"
                                    : line.fontFamily === "Courier"
                                    ? "Courier, monospace"
                                    : "Arial, Helvetica, sans-serif",
                                fontWeight: line.isBold ? 700 : 400,
                                fontStyle: line.isItalic ? "italic" : "normal",
                                height: "100%",
                                lineHeight: "1",
                                whiteSpace: "nowrap",
                                width: `${Math.max(line.currentText.length + 2, 4)}ch`,
                              }}
                              className="bg-white border-none outline-hidden p-0 m-0 whitespace-nowrap min-w-[24px]"
                            />
                            <button
                              type="button"
                              onClick={() => deleteTextLine(line.id)}
                              className="p-0.5 text-slate-400 hover:text-red-600 ml-1 cursor-pointer shrink-0"
                              title="Delete this line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      }

                      if (line.isEdited) {
                        // Edited Line (Saved): Solid white cover with newly typed text displayed with exact typography - NO TRUNCATE OR ELLIPSIS
                        return (
                          <div
                            key={line.id}
                            className="absolute bg-white border border-blue-400 rounded-xs flex items-center px-0.5 cursor-pointer group hover:ring-1 hover:ring-blue-500 z-10"
                            style={{
                              left: `${line.normX * 100}%`,
                              top: `${line.normY * 100}%`,
                              minWidth: `${line.normW * 100}%`,
                              width: "max-content",
                              maxWidth: `${(1 - line.normX) * 100}%`,
                              height: `${line.normH * 100}%`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              saveHistorySnapshot();
                              setActiveEditingLineId(line.id);
                            }}
                            title="Click to re-edit this modified line"
                          >
                            <span
                              style={{
                                color: line.color,
                                fontSize: `${Math.round(line.fontSize * (line.scale || 1.411) * zoomScale * 10) / 10}px`,
                                fontFamily:
                                  line.fontFamily === "Times"
                                    ? "'Times New Roman', serif"
                                    : line.fontFamily === "Courier"
                                    ? "Courier, monospace"
                                    : "Arial, Helvetica, sans-serif",
                                fontWeight: line.isBold ? 700 : 400,
                                fontStyle: line.isItalic ? "italic" : "normal",
                                lineHeight: "1",
                                whiteSpace: "nowrap",
                              }}
                              className="block whitespace-nowrap"
                            >
                              {line.currentText}
                            </span>
                          </div>
                        );
                      }

                      // Original Line (Unedited): Transparent hover hotspot
                      return (
                        <div
                          key={line.id}
                          className="absolute bg-transparent hover:bg-blue-500/10 hover:border hover:border-dashed hover:border-blue-500 rounded-xs transition-all cursor-pointer group"
                          style={{
                            left: `${line.normX * 100}%`,
                            top: `${line.normY * 100}%`,
                            width: `${line.normW * 100}%`,
                            height: `${line.normH * 100}%`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            saveHistorySnapshot();
                            setActiveEditingLineId(line.id);
                          }}
                          title={`Click to edit: "${line.originalText}"`}
                        >
                          <div className="absolute -top-3.5 right-0 bg-blue-600 text-white text-[9px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition shadow-xs z-30">
                            Edit
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 2. CUSTOM USER-PLACED ELEMENTS LAYER (Whiteouts, stamps, signatures, new text) */}
                  <div className="absolute inset-0 z-30 pointer-events-none">
                    {pageCustomElems.map((elem) => {
                      const isSelected = elem.id === selectedCustomElemId;

                      return (
                        <div
                          key={elem.id}
                          className={`absolute group cursor-move pointer-events-auto ${
                            isSelected
                              ? "ring-2 ring-blue-600 ring-offset-1 z-40"
                              : "hover:ring-1 hover:ring-blue-400 z-30"
                          }`}
                          style={{
                            left: `${elem.normX * 100}%`,
                            top: `${elem.normY * 100}%`,
                            width: `${elem.normW * 100}%`,
                            height: `${elem.normH * 100}%`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomElemId(elem.id);
                          }}
                          onPointerDown={(e) => {
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
                          {elem.type === "whiteout" ? (
                            <div className="w-full h-full bg-white border border-dashed border-slate-300 shadow-2xs flex items-center justify-center text-[10px] text-slate-400 select-none">
                              {isSelected && <span className="opacity-60 font-mono">Whiteout</span>}
                            </div>
                          ) : elem.type === "highlight" ? (
                            <div
                              className="w-full h-full opacity-40 rounded-xs"
                              style={{ backgroundColor: elem.color || "#facc15" }}
                            />
                          ) : elem.type === "text" ? (
                            <div
                              className="w-full h-full p-1 overflow-hidden flex items-start bg-white/90 border border-slate-200 rounded"
                              style={{
                                color: elem.color || "#000000",
                                fontSize: `${(elem.fontSize || 14) * zoomScale}px`,
                                fontFamily:
                                  elem.fontFamily === "Times"
                                    ? "'Times New Roman', serif"
                                    : elem.fontFamily === "Courier"
                                    ? "Courier, monospace"
                                    : "Arial, Helvetica, sans-serif",
                                fontWeight: elem.isBold ? 700 : 400,
                                fontStyle: elem.isItalic ? "italic" : "normal",
                                lineHeight: "1.25",
                              }}
                            >
                              <textarea
                                value={elem.text || ""}
                                onChange={(e) => {
                                  setCustomElements((prev) =>
                                    prev.map((item) =>
                                      item.id === elem.id ? { ...item, text: e.target.value } : item
                                    )
                                  );
                                }}
                                className="w-full h-full bg-transparent resize-none border-none outline-hidden p-0 m-0"
                                placeholder="Type new text..."
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

                          {/* Resize Handle */}
                          {isSelected && (
                            <div
                              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white shadow-xs cursor-nwse-resize z-50"
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

      {/* SIGNATURE PAD MODAL */}
      <SignaturePadModal
        isOpen={sigModalOpen}
        title="Create Signature to Stamp"
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
