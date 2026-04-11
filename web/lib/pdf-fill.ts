/**
 * PDF fill engine — loads a blank institutional balance sheet PDF and
 * overlays the student's course data at precise field positions.
 *
 * Data flow:
 *   buildBalanceSheetViewModel (lib/balance-sheet.ts)
 *     └─ fillBalanceSheetPdf (lib/pdf-fill.ts)
 *         → Uint8Array (download as .pdf)
 *
 * Setup:
 *   1. Drop the blank Fisk CS balance sheet into public/templates/cs-balance-sheet.pdf
 *   2. Run detectPdfFields() in the browser console to discover AcroForm field names,
 *      OR use FIELD_MAP below to define x/y overlay coordinates per page.
 *   3. Replace the placeholder FIELD_MAP entries with real values.
 *
 * Two modes (auto-detected):
 *   A. AcroForm (fillable PDF) — field names from detectPdfFields(); fill by name.
 *   B. Static PDF             — text overlay at x/y coordinates in FIELD_MAP.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { BalanceSheetGroupView, BalanceSheetRenderableRow } from "@/lib/balance-sheet";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfFillInput {
  studentName: string;
  majorName: string;
  gpa: number | null;
  entryLabel: string | null;
  gradLabel: string | null;
  creditsEarned: number;
  creditsRequired: number;
  degreeType: string;
  groups: BalanceSheetGroupView[];
  printDate: string;
}

/**
 * One slot on the static PDF where we write a value.
 * page is 0-indexed. x/y are from the bottom-left corner in PDF points (72 pts = 1 inch).
 */
interface FieldSlot {
  page: number;
  x: number;
  y: number;
  maxWidth?: number;
  fontSize?: number;
}

// ─── Field map ────────────────────────────────────────────────────────────────
// TODO: Replace these placeholder coordinates with real values once the
//       cs-balance-sheet.pdf is in public/templates/ and measured.
//
// To measure: open the PDF in Adobe Acrobat or a PDF viewer, note the
// position of each field in points (1 inch = 72 pts, origin = bottom-left).
// Or run detectPdfFields() if the PDF has AcroForm fields.

const HEADER_SLOTS: Record<string, FieldSlot> = {
  studentName:   { page: 0, x: 160, y: 710, fontSize: 10 },
  major:         { page: 0, x: 380, y: 710, fontSize: 10 },
  gpa:           { page: 0, x: 160, y: 695, fontSize: 10 },
  entryTerm:     { page: 0, x: 380, y: 695, fontSize: 10 },
  gradTerm:      { page: 0, x: 490, y: 695, fontSize: 10 },
  creditsEarned: { page: 0, x: 160, y: 680, fontSize: 10 },
  date:          { page: 0, x: 490, y: 680, fontSize: 10 },
};

/**
 * Course row slots — one entry per row slot on the PDF form.
 * Each entry maps to a physical line on the balance sheet.
 * key: "<groupIndex>-<rowIndex>" (e.g. "0-0" = first group, first course slot)
 *
 * TODO: Populate with real coordinates after measuring the PDF.
 */
const COURSE_ROW_SLOTS: Record<
  string,
  { code: FieldSlot; grade: FieldSlot; term: FieldSlot; credits: FieldSlot }
> = {
  // Example — replace with real measurements:
  // "0-0": {
  //   code:    { page: 0, x: 60,  y: 620, fontSize: 9 },
  //   grade:   { page: 0, x: 310, y: 620, fontSize: 9 },
  //   term:    { page: 0, x: 360, y: 620, fontSize: 9 },
  //   credits: { page: 0, x: 450, y: 620, fontSize: 9 },
  // },
};

// ─── AcroForm detection (run once in browser console) ─────────────────────────

/**
 * Call this from the browser console to list all AcroForm field names in the PDF.
 * If the PDF has fields, use those names instead of coordinate slots.
 *
 * Usage:
 *   import { detectPdfFields } from "@/lib/pdf-fill";
 *   detectPdfFields("/templates/cs-balance-sheet.pdf").then(console.log);
 */
export async function detectPdfFields(pdfUrl: string): Promise<string[]> {
  const bytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  return form.getFields().map((f) => f.getName());
}

// ─── Main fill function ───────────────────────────────────────────────────────

/**
 * Loads the blank balance sheet PDF, overlays student data, and returns
 * the filled PDF bytes ready for download.
 *
 * Throws if the template PDF is not found at /templates/cs-balance-sheet.pdf.
 */
export async function fillBalanceSheetPdf(input: PdfFillInput): Promise<Uint8Array> {
  const templateUrl = "/templates/cs-balance-sheet.pdf";
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(
      `Balance sheet template not found at ${templateUrl}. ` +
      `Place the blank Fisk CS balance sheet PDF there to enable this feature.`
    );
  }

  const templateBytes = await response.arrayBuffer();
  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // ── Check for AcroForm fields ──────────────────────────────────────────────
  const form = doc.getForm();
  const fieldNames = form.getFields().map((f) => f.getName());
  const hasAcroForm = fieldNames.length > 0;

  if (hasAcroForm) {
    // Mode A: fill by field name
    fillAcroForm(form, input, fieldNames);
    form.flatten();
  } else {
    // Mode B: text overlay at coordinates
    fillCoordinateOverlay(pages, font, boldFont, input);
  }

  return doc.save();
}

// ─── Mode A: AcroForm fill ────────────────────────────────────────────────────

function fillAcroForm(
  form: ReturnType<PDFDocument["getForm"]>,
  input: PdfFillInput,
  _fieldNames: string[]
) {
  // TODO: Map field names (from detectPdfFields) to input values.
  // Example:
  //   safeSetText(form, "StudentName", input.studentName);
  //   safeSetText(form, "GPA", input.gpa?.toFixed(2) ?? "");
  //
  // Once you've run detectPdfFields() and know the names, fill them in here.
  void form; void input;
}

function safeSetText(
  form: ReturnType<PDFDocument["getForm"]>,
  fieldName: string,
  value: string
) {
  try {
    form.getTextField(fieldName).setText(value);
  } catch {
    // Field doesn't exist in this PDF version — skip silently
  }
}

// ─── Mode B: coordinate overlay ───────────────────────────────────────────────

function fillCoordinateOverlay(
  pages: ReturnType<PDFDocument["getPages"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  boldFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  input: PdfFillInput
) {
  const draw = (slot: FieldSlot, text: string, bold = false) => {
    const page = pages[slot.page];
    if (!page) return;
    page.drawText(text, {
      x: slot.x,
      y: slot.y,
      size: slot.fontSize ?? 9,
      font: bold ? boldFont : font,
      color: rgb(0, 0, 0),
      maxWidth: slot.maxWidth,
    });
  };

  // Header fields
  draw(HEADER_SLOTS.studentName,   input.studentName, true);
  draw(HEADER_SLOTS.major,         input.majorName);
  draw(HEADER_SLOTS.gpa,           input.gpa != null ? input.gpa.toFixed(2) : "");
  draw(HEADER_SLOTS.entryTerm,     input.entryLabel ?? "");
  draw(HEADER_SLOTS.gradTerm,      input.gradLabel ?? "");
  draw(HEADER_SLOTS.creditsEarned, `${input.creditsEarned} / ${input.creditsRequired} cr`);
  draw(HEADER_SLOTS.date,          input.printDate);

  // Course rows
  let globalRowIdx = 0;
  input.groups.forEach((group, groupIdx) => {
    group.rows.forEach((row: BalanceSheetRenderableRow, rowIdx: number) => {
      if (row.kind !== "course") return;
      const slotKey = `${groupIdx}-${rowIdx}`;
      const globalKey = `row-${globalRowIdx}`;
      const slots = COURSE_ROW_SLOTS[slotKey] ?? COURSE_ROW_SLOTS[globalKey];
      if (!slots) { globalRowIdx++; return; }

      draw(slots.code,    row.code);
      draw(slots.grade,   row.grade ?? (row.status === "planned" ? "—" : ""));
      draw(slots.term,    row.termCode ?? "");
      draw(slots.credits, String(row.actualCredits ?? row.templateCredits ?? ""));
      globalRowIdx++;
    });
  });
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
