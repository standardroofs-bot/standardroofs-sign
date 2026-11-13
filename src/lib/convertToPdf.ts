import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

function sanitizePdfText(input: string): string {
  // WinAnsi encoding in StandardFonts supports ASCII + Latin-1; replace unsupported chars safely
  return input.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!w) continue;
    if ((current + " " + w).trim().length <= maxChars) {
      current = (current + " " + w).trim();
    } else {
      if (current) lines.push(current);
      current = w.length > maxChars ? w.slice(0, maxChars) : w;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export async function convertDocxToPdf(
  buffer: Buffer,
  title: string
): Promise<Buffer> {
  const result = await mammoth.extractRawText({ buffer });
  const rawText = sanitizePdfText(result.value || "");
  const paragraphs = rawText.split(/\r?\n/);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 44;
  const lineHeight = 14.5;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText(sanitizePdfText(title).slice(0, 75), {
    x: margin,
    y,
    size: 13,
    font: bold,
    color: rgb(0.6, 0.11, 0.11),
  });
  y -= 22;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.75,
    color: rgb(0.82, 0.85, 0.9),
  });
  y -= 18;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      y -= 8;
      continue;
    }
    const lines = wrapText(trimmed, 88);
    for (const line of lines) {
      if (y < margin + 20) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.08, 0.12, 0.2),
      });
      y -= lineHeight;
    }
    y -= 4;
  }

  return Buffer.from(await pdfDoc.save());
}

export async function convertSpreadsheetToPdf(
  buffer: Buffer,
  title: string
): Promise<Buffer> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
    });

    const maxCols = Math.max(
      1,
      ...rows.map((r) => (Array.isArray(r) ? r.length : 1))
    );
    const landscape = maxCols > 5;
    const pageWidth = landscape ? 841.89 : 595.28;
    const pageHeight = landscape ? 595.28 : 841.89;
    const margin = 32;
    const usableW = pageWidth - margin * 2;
    const colW = usableW / Math.min(maxCols, 10);
    const rowH = 18;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    page.drawText(
      sanitizePdfText(`${title} — ${sheetName}`).slice(0, 95),
      {
        x: margin,
        y,
        size: 12,
        font: bold,
        color: rgb(0.6, 0.11, 0.11),
      }
    );
    y -= 22;

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = Array.isArray(rows[rIdx]) ? rows[rIdx] : [rows[rIdx]];
      if (row.every((c) => String(c ?? "").trim() === "")) continue;

      if (y < margin + rowH) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      const isHeader = rIdx === 0;
      if (isHeader) {
        page.drawRectangle({
          x: margin,
          y: y - 4,
          width: usableW,
          height: rowH,
          color: rgb(0.95, 0.96, 0.98),
        });
      }

      const colsToShow = Math.min(maxCols, 10);
      const maxChars = Math.max(6, Math.floor(colW / 5.2));
      for (let c = 0; c < colsToShow; c++) {
        const cellText = sanitizePdfText(String(row[c] ?? "").trim()).slice(
          0,
          maxChars
        );
        page.drawText(cellText, {
          x: margin + c * colW + 3,
          y: y + 1,
          size: isHeader ? 8.5 : 8,
          font: isHeader ? bold : font,
          color: rgb(0.08, 0.12, 0.2),
        });
      }

      page.drawLine({
        start: { x: margin, y: y - 4 },
        end: { x: pageWidth - margin, y: y - 4 },
        thickness: 0.4,
        color: rgb(0.86, 0.88, 0.92),
      });
      y -= rowH;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

