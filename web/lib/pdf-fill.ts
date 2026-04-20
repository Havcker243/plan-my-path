import {
  PDFDocument,
  PDFFont,
  PDFPage,
  PDFTextField,
  rgb,
  StandardFonts,
} from "pdf-lib";
import type {
  BalanceSheetCoursePairRow,
  BalanceSheetGroupView,
  BalanceSheetRenderableRow,
  BalanceSheetRow,
} from "@/lib/balance-sheet";
import type { BalanceSheetPdfMatch } from "@/lib/api";

export interface PdfFillInput {
  studentName: string;
  majorCode?: string | null;
  majorName: string;
  gpa: number | null;
  entryLabel: string | null;
  gradLabel: string | null;
  creditsEarned: number;
  creditsRequired: number;
  degreeType: string;
  groups: BalanceSheetGroupView[];
  printNotes?: string[];
  printDate: string;
}

interface FieldSlot {
  page: number;
  x: number;
  y: number;
  maxWidth?: number;
  fontSize?: number;
}

interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface GeneratedRow {
  group: string;
  mark: string;
  course: string;
  title: string;
  grade: string;
  term: string;
  credits: string;
  status: string;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;
const TABLE_BOTTOM = 86;
const ROW_HEIGHT = 20;

const HEADER_SLOTS: Record<string, FieldSlot> = {
  studentName: { page: 0, x: 160, y: 710, fontSize: 10 },
  major: { page: 0, x: 380, y: 710, fontSize: 10 },
  gpa: { page: 0, x: 160, y: 695, fontSize: 10 },
  entryTerm: { page: 0, x: 380, y: 695, fontSize: 10 },
  gradTerm: { page: 0, x: 490, y: 695, fontSize: 10 },
  creditsEarned: { page: 0, x: 160, y: 680, fontSize: 10 },
  date: { page: 0, x: 490, y: 680, fontSize: 10 },
};

const COURSE_ROW_SLOTS: Record<
  string,
  { code: FieldSlot; grade: FieldSlot; term: FieldSlot; credits: FieldSlot }
> = {};

export async function detectPdfFields(pdfUrl: string): Promise<string[]> {
  const bytes = await fetch(pdfUrl).then((response) => response.arrayBuffer());
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  return form.getFields().map((field) => field.getName());
}

export async function fillBalanceSheetPdf(input: PdfFillInput): Promise<Uint8Array> {
  const templateBytes = await fetchTemplate(input.majorCode);

  if (!templateBytes) {
    return createGeneratedBalanceSheetPdf(input);
  }

  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();
  const fieldNames = form.getFields().map((field) => field.getName());

  if (fieldNames.length > 0) {
    fillAcroForm(form, input);
    form.flatten();
  } else {
    fillCoordinateOverlay(pages, { regular, bold }, input);
  }

  return doc.save();
}

async function fetchTemplate(majorCode: string | null | undefined): Promise<ArrayBuffer | null> {
  const normalizedMajor = majorCode?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? null;
  const candidates = [
    normalizedMajor ? `/templates/${normalizedMajor}-balance-sheet.pdf` : null,
    "/templates/degree-audit-template.pdf",
    "/templates/cs-balance-sheet.pdf",
  ].filter((value): value is string => Boolean(value));

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.arrayBuffer();
    } catch {
      // The generated PDF path below is the fallback when no template exists.
    }
  }

  return null;
}

function fillAcroForm(form: ReturnType<PDFDocument["getForm"]>, input: PdfFillInput) {
  setAnyText(form, ["StudentName", "student_name", "studentName", "Name"], input.studentName);
  setAnyText(form, ["Major", "major", "Program"], input.majorName);
  setAnyText(form, ["Degree", "degree", "DegreeType"], input.degreeType);
  setAnyText(form, ["GPA", "gpa"], input.gpa != null ? input.gpa.toFixed(2) : "");
  setAnyText(form, ["EntryTerm", "entry_term", "entryTerm"], input.entryLabel ?? "");
  setAnyText(form, ["GradTerm", "graduation_term", "gradTerm"], input.gradLabel ?? "");
  setAnyText(form, ["CreditsEarned", "credits_earned"], String(input.creditsEarned));
  setAnyText(form, ["CreditsRequired", "credits_required"], String(input.creditsRequired));
  setAnyText(form, ["Date", "date", "PrintDate"], input.printDate);
}

function setAnyText(form: ReturnType<PDFDocument["getForm"]>, fieldNames: string[], value: string) {
  for (const fieldName of fieldNames) {
    try {
      const field = form.getFieldMaybe(fieldName);
      if (field instanceof PDFTextField) {
        field.setText(value);
      }
    } catch {
      // Field name is not present in this template version.
    }
  }
}

function fillCoordinateOverlay(
  pages: PDFPage[],
  fonts: PdfFonts,
  input: PdfFillInput
) {
  const draw = (slot: FieldSlot, text: string, bold = false) => {
    const page = pages[slot.page];
    if (!page) return;
    page.drawText(text, {
      x: slot.x,
      y: slot.y,
      size: slot.fontSize ?? 9,
      font: bold ? fonts.bold : fonts.regular,
      color: rgb(0, 0, 0),
      maxWidth: slot.maxWidth,
    });
  };

  draw(HEADER_SLOTS.studentName, input.studentName, true);
  draw(HEADER_SLOTS.major, input.majorName);
  draw(HEADER_SLOTS.gpa, input.gpa != null ? input.gpa.toFixed(2) : "");
  draw(HEADER_SLOTS.entryTerm, input.entryLabel ?? "");
  draw(HEADER_SLOTS.gradTerm, input.gradLabel ?? "");
  draw(HEADER_SLOTS.creditsEarned, `${input.creditsEarned} / ${input.creditsRequired} cr`);
  draw(HEADER_SLOTS.date, input.printDate);

  let globalRowIndex = 0;
  input.groups.forEach((group, groupIndex) => {
    group.rows.forEach((row, rowIndex) => {
      if (row.kind !== "course") return;
      const slotKey = `${groupIndex}-${rowIndex}`;
      const globalKey = `row-${globalRowIndex}`;
      const slots = COURSE_ROW_SLOTS[slotKey] ?? COURSE_ROW_SLOTS[globalKey];
      if (!slots) {
        globalRowIndex += 1;
        return;
      }

      draw(slots.code, row.code);
      draw(slots.grade, row.grade ?? "");
      draw(slots.term, row.termCode ?? "");
      draw(slots.credits, String(row.actualCredits ?? row.templateCredits ?? ""));
      globalRowIndex += 1;
    });
  });
}

async function createGeneratedBalanceSheetPdf(input: PdfFillInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const rows = flattenRows(input.groups);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(page, fonts, input);
  let y = drawSummary(page, fonts, input, PAGE_HEIGHT - 150);
  y = drawTableHeader(page, fonts, y - 22);

  let currentGroup = "";
  rows.forEach((row) => {
    if (y < TABLE_BOTTOM) {
      drawFooter(page, fonts, input, doc.getPageCount());
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawTableHeader(page, fonts, PAGE_HEIGHT - MARGIN);
      currentGroup = "";
    }

    if (row.group !== currentGroup) {
      if (y < TABLE_BOTTOM + ROW_HEIGHT) {
        drawFooter(page, fonts, input, doc.getPageCount());
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = drawTableHeader(page, fonts, PAGE_HEIGHT - MARGIN);
      }
      y = drawGroupRow(page, fonts, row.group, y);
      currentGroup = row.group;
    }

    drawCourseRow(page, fonts, row, y);
    y -= ROW_HEIGHT;
  });

  if (rows.length === 0) {
    page.drawText("No requirements are available for this degree audit.", {
      x: MARGIN,
      y,
      size: 11,
      font: fonts.regular,
      color: rgb(0.25, 0.25, 0.25),
    });
  }

  y -= 16;
  drawNotes(page, fonts, input, y);
  drawFooter(page, fonts, input, doc.getPageCount());

  return doc.save();
}

function drawHeader(page: PDFPage, fonts: PdfFonts, input: PdfFillInput) {
  page.drawText("FISK UNIVERSITY", {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN,
    size: 13,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });
  page.drawText(`${input.majorName} Degree Evaluation Balance Sheet`, {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 18,
    size: 11,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });
  page.drawText(`Generated ${input.printDate}`, {
    x: PAGE_WIDTH - MARGIN - 116,
    y: PAGE_HEIGHT - MARGIN,
    size: 9,
    font: fonts.regular,
    color: rgb(0.25, 0.25, 0.25),
  });
  drawLine(page, MARGIN, PAGE_HEIGHT - MARGIN - 29, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 29);
}

function drawSummary(page: PDFPage, fonts: PdfFonts, input: PdfFillInput, y: number) {
  const left = MARGIN;
  const mid = MARGIN + 270;
  const lineHeight = 15;
  const gpa = input.gpa != null ? input.gpa.toFixed(2) : "N/A";
  const remaining = Math.max(0, input.creditsRequired - input.creditsEarned);

  drawLabelValue(page, fonts, "Student", input.studentName, left, y);
  drawLabelValue(page, fonts, "Major", input.majorName, mid, y);
  y -= lineHeight;
  drawLabelValue(page, fonts, "Entry", input.entryLabel ?? "N/A", left, y);
  drawLabelValue(page, fonts, "Expected Grad", input.gradLabel ?? "N/A", mid, y);
  y -= lineHeight;
  drawLabelValue(page, fonts, "GPA", gpa, left, y);
  drawLabelValue(page, fonts, "Degree", input.degreeType, mid, y);
  y -= lineHeight;
  drawLabelValue(page, fonts, "Credits Earned", `${input.creditsEarned} / ${input.creditsRequired}`, left, y);
  drawLabelValue(page, fonts, "Remaining", String(remaining), mid, y);

  return y;
}

function drawLabelValue(page: PDFPage, fonts: PdfFonts, label: string, value: string, x: number, y: number) {
  page.drawText(`${label}:`, {
    x,
    y,
    size: 9,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });
  page.drawText(truncateText(value, fonts.regular, 9, 172), {
    x: x + 78,
    y,
    size: 9,
    font: fonts.regular,
    color: rgb(0, 0, 0),
  });
}

function drawTableHeader(page: PDFPage, fonts: PdfFonts, y: number) {
  page.drawRectangle({
    x: MARGIN,
    y: y - 4,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 19,
    color: rgb(0.93, 0.93, 0.93),
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.7,
  });
  drawText(page, fonts.bold, "Mark", 48, y, 8);
  drawText(page, fonts.bold, "Course", 84, y, 8);
  drawText(page, fonts.bold, "Title", 146, y, 8);
  drawText(page, fonts.bold, "Grade", 398, y, 8);
  drawText(page, fonts.bold, "Term", 438, y, 8);
  drawText(page, fonts.bold, "Cr", 480, y, 8);
  drawText(page, fonts.bold, "Status", 510, y, 8);
  return y - 22;
}

function drawGroupRow(page: PDFPage, fonts: PdfFonts, groupName: string, y: number) {
  page.drawRectangle({
    x: MARGIN,
    y: y - 5,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 19,
    color: rgb(0.82, 0.87, 0.95),
  });
  drawText(page, fonts.bold, truncateText(groupName, fonts.bold, 8.5, 510), MARGIN + 6, y, 8.5);
  return y - 20;
}

function drawCourseRow(page: PDFPage, fonts: PdfFonts, row: GeneratedRow, y: number) {
  drawLine(page, MARGIN, y - 7, PAGE_WIDTH - MARGIN, y - 7, 0.25, rgb(0.82, 0.82, 0.82));
  drawText(page, fonts.regular, row.mark, 52, y, 8);
  drawText(page, fonts.bold, truncateText(row.course, fonts.bold, 8, 56), 84, y, 8);
  drawText(page, fonts.regular, truncateText(row.title, fonts.regular, 8, 236), 146, y, 8);
  drawText(page, fonts.regular, row.grade, 400, y, 8);
  drawText(page, fonts.regular, row.term, 438, y, 8);
  drawText(page, fonts.regular, row.credits, 482, y, 8);
  drawText(page, fonts.regular, row.status, 510, y, 8);
}

function drawNotes(page: PDFPage, fonts: PdfFonts, input: PdfFillInput, y: number) {
  const notes = input.printNotes ?? [];
  if (notes.length === 0 || y < TABLE_BOTTOM + 40) return;

  drawText(page, fonts.bold, "Advisor Notes", MARGIN, y, 9);
  y -= 13;

  notes.slice(0, 4).forEach((note) => {
    const wrapped = wrapText(note, fonts.regular, 8, PAGE_WIDTH - MARGIN * 2 - 14);
    wrapped.slice(0, 2).forEach((line, index) => {
      drawText(page, fonts.regular, `${index === 0 ? "- " : "  "}${line}`, MARGIN + 8, y, 8);
      y -= 11;
    });
  });
}

function drawFooter(page: PDFPage, fonts: PdfFonts, input: PdfFillInput, pageNumber: number) {
  drawLine(page, MARGIN, 62, PAGE_WIDTH - MARGIN, 62);
  drawText(page, fonts.bold, "Advisor Signature:", MARGIN, 42, 9);
  drawLine(page, MARGIN + 88, 40, MARGIN + 286, 40);
  drawText(page, fonts.bold, "Date:", MARGIN + 320, 42, 9);
  drawLine(page, MARGIN + 348, 40, MARGIN + 448, 40);
  drawText(page, fonts.regular, `Page ${pageNumber}`, PAGE_WIDTH - MARGIN - 42, 42, 8);
  drawText(page, fonts.regular, `FiskGrad degree audit - ${input.printDate}`, MARGIN, 24, 7);
}

function flattenRows(groups: BalanceSheetGroupView[]): GeneratedRow[] {
  const rows: GeneratedRow[] = [];

  groups.forEach((group) => {
    group.rows.forEach((row) => {
      rows.push(...rowToGeneratedRows(group.displayName, row));
    });
  });

  return rows;
}

function rowToGeneratedRows(groupName: string, row: BalanceSheetRenderableRow): GeneratedRow[] {
  if (row.kind === "course") return [courseToGeneratedRow(groupName, row)];
  if (row.kind === "course_pair") return pairToGeneratedRows(groupName, row);
  if (row.kind === "choice_summary") {
    return [noteToGeneratedRow(groupName, row.text)];
  }
  if (row.kind === "bucket") {
    const suffix = row.creditsRequiredText ? ` (${row.creditsRequiredText})` : "";
    return [noteToGeneratedRow(groupName, `${row.label}${suffix}`)];
  }
  return [noteToGeneratedRow(groupName, row.text)];
}

function pairToGeneratedRows(groupName: string, row: BalanceSheetCoursePairRow): GeneratedRow[] {
  const label = row.relationship === "corequisite"
    ? `Corequisite: ${row.label}`
    : row.relationship === "alternative"
    ? `Alternative: ${row.label}`
    : row.label;

  return [
    noteToGeneratedRow(groupName, label),
    ...row.courses.map((course) => courseToGeneratedRow(groupName, course)),
  ];
}

function noteToGeneratedRow(groupName: string, text: string): GeneratedRow {
  return {
    group: groupName,
    mark: "",
    course: "",
    title: text,
    grade: "",
    term: "",
    credits: "",
    status: "",
  };
}

function courseToGeneratedRow(groupName: string, row: BalanceSheetRow): GeneratedRow {
  return {
    group: groupName,
    mark: row.status === "completed" ? "X" : "",
    course: row.code,
    title: row.name,
    grade: row.grade ?? "",
    term: row.termCode ?? "",
    credits: String(row.actualCredits ?? row.templateCredits ?? ""),
    status: row.status === "completed" ? "Completed" : row.status === "planned" ? "Planned" : "Open",
  };
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number) {
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawLine(
  page: PDFPage,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness = 0.7,
  color = rgb(0, 0, 0)
) {
  page.drawLine({
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    thickness,
    color,
  });
}

function truncateText(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = "...";
  let value = text;
  while (value.length > 0 && font.widthOfTextAtSize(`${value}${ellipsis}`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}${ellipsis}`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      return;
    }
    if (line) lines.push(line);
    line = word;
  });

  if (line) lines.push(line);
  return lines;
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fillCustomBalanceSheetPdf(input: {
  file: File;
  matches: BalanceSheetPdfMatch[];
  groups: BalanceSheetGroupView[];
}): Promise<Uint8Array> {
  const bytes = await input.file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const rows = new Map<string, BalanceSheetRow>();

  input.groups.forEach((group) => {
    flattenRowsToCourses(group.rows).forEach((row) => {
      rows.set(normalizePdfCourseCode(row.code), row);
    });
  });

  input.matches.forEach((match) => {
    const row = rows.get(normalizePdfCourseCode(match.course_code));
    if (!row) return;
    const page = doc.getPages()[match.page];
    if (!page) return;

    const size = Math.max(8, Math.min(10, match.font_size || 9));
    const mark = row.status === "completed" ? "X" : row.status === "planned" ? "N" : "";
    const grade = row.grade ?? (row.status === "planned" ? "N" : "");
    const term = row.termCode ?? "";
    const credits = row.actualCredits ?? row.templateCredits;
    const y = match.y - 1;

    if (mark) {
      page.drawText(mark, {
        x: Math.max(10, match.x - 20),
        y,
        size,
        font: bold,
        color: rgb(0, 0, 0),
      });
    }
    if (grade) {
      page.drawText(grade, {
        x: match.x + 190,
        y,
        size,
        font: regular,
        color: rgb(0, 0, 0),
      });
    }
    if (term) {
      page.drawText(term, {
        x: match.x + 230,
        y,
        size,
        font: regular,
        color: rgb(0, 0, 0),
      });
    }
    if (credits != null) {
      page.drawText(String(credits), {
        x: match.x + 278,
        y,
        size,
        font: regular,
        color: rgb(0, 0, 0),
      });
    }
  });

  return doc.save();
}

function flattenRowsToCourses(rows: BalanceSheetRenderableRow[]): BalanceSheetRow[] {
  return rows.flatMap((row) => {
    if (row.kind === "course") return [row];
    if (row.kind === "course_pair") return row.courses;
    return [];
  });
}

function normalizePdfCourseCode(code: string): string {
  return code.replace(/[-\s]+/g, " ").trim().toUpperCase();
}
