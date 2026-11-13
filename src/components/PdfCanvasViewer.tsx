"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface RenderedPage {
  pageNumber: number;
  width: number;
  height: number;
  dataUrl: string;
}

interface PdfCanvasViewerProps {
  pdfUrl: string;
  renderOverlay?: (pageNumber: number, pageWidth: number, pageHeight: number) => React.ReactNode;
  onPageClick?: (
    pageNumber: number,
    normX: number,
    normY: number
  ) => void;
  onLoaded?: (pageCount: number) => void;
}

export default function PdfCanvasViewer({
  pdfUrl,
  renderOverlay,
  onPageClick,
  onLoaded,
}: PdfCanvasViewerProps) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedCbRef = useRef(onLoaded);
  loadedCbRef.current = onLoaded;

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: true,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const rendered: RenderedPage[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const targetWidth = 820;
          const scale = targetWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;

          rendered.push({
            pageNumber: i,
            width: canvas.width,
            height: canvas.height,
            dataUrl: canvas.toDataURL("image/png"),
          });
        }

        if (!cancelled) {
          setPages(rendered);
          loadedCbRef.current?.(pdf.numPages);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("PDF render error:", err);
          setError("Could not render PDF preview. Check that the file is a valid PDF.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-7 h-7 animate-spin text-orange-700" />
        <span className="text-sm font-medium">Rendering PDF pages...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pages.map((p) => (
        <div key={p.pageNumber} className="flex flex-col items-center">
          <div className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
            Page {p.pageNumber} of {pages.length}
          </div>
          <div
            className="relative bg-white shadow-md border border-slate-300 rounded-md overflow-hidden select-none w-full max-w-[820px]"
            style={{ aspectRatio: `${p.width} / ${p.height}` }}
            onClick={(e) => {
              if (!onPageClick) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const normX = (e.clientX - rect.left) / rect.width;
              const normY = (e.clientY - rect.top) / rect.height;
              onPageClick(p.pageNumber, normX, normY);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.dataUrl}
              alt={`PDF Page ${p.pageNumber}`}
              className="w-full h-full block pointer-events-none"
              draggable={false}
            />
            <div className="absolute inset-0">
              {renderOverlay?.(p.pageNumber, p.width, p.height)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

