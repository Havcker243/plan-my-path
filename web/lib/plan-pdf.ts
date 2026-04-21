import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Course, RequirementLabel, Semester } from "@/lib/data";

export interface PlanPdfProfile {
  name: string;
  majorName: string | null;
  minorName: string | null;
  entryLabel: string | null;
  gradLabel: string | null;
  gpa: string | null;
}

export interface PlanPdfInput {
  profile: PlanPdfProfile;
  semesters: Semester[];
  planCatalog: Record<string, Course>;
  completedCredits: number;
  plannedCredits: number;
  totalCredits: number;
  printDate: string;
}

interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;
const TABLE_ROW_HEIGHT = 18;

const LABEL_BADGE: Record<RequirementLabel, string> = {
  required: "REQ",
  group: "GRP",
  elective: "ELC",
  general: "GEN",
};

export async function buildPlanPdf(input: PlanPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: PdfFonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const nonEmptySemesters = input.semesters.filter((semester) => semester.courseIds.length > 0);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawHeader(page, fonts, input);
  y = drawSummary(page, fonts, input, y - 18);

  if (nonEmptySemesters.length === 0) {
    page.drawText("No courses have been added to this plan yet.", {
      x: MARGIN,
      y: y - 24,
      size: 11,
      font: fonts.regular,
      color: rgb(0.35, 0.35, 0.35),
    });
  } else {
    for (const semester of nonEmptySemesters) {
      const rowCount = Math.max(semester.courseIds.length, 1);
      const blockHeight = 28 + 20 + rowCount * TABLE_ROW_HEIGHT + 18;
      if (y - blockHeight < 78) {
        drawFooter(page, fonts, input.printDate, doc.getPageCount());
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = drawHeader(page, fonts, input);
      }
      y = drawSemesterBlock(page, fonts, input, semester, y - 14);
    }
  }

  drawFooter(page, fonts, input.printDate, doc.getPageCount());
  return doc.save();
}

function drawHeader(page: PDFPage, fonts: PdfFonts, input: PlanPdfInput) {
  page.drawText("FISKGRAD ACADEMIC PLAN", {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN,
    size: 16,
    font: fonts.bold,
    color: rgb(0.08, 0.08, 0.08),
  });
  page.drawText(input.profile.name, {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 24,
    size: 20,
    font: fonts.bold,
    color: rgb(0.08, 0.08, 0.08),
  });

  const program = [input.profile.majorName, input.profile.minorName ? `Minor: ${input.profile.minorName}` : null]
    .filter(Boolean)
    .join(" / ");
  if (program) {
    page.drawText(program, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - 40,
      size: 10,
      font: fonts.regular,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  page.drawText(`Generated ${input.printDate}`, {
    x: PAGE_WIDTH - MARGIN - 120,
    y: PAGE_HEIGHT - MARGIN,
    size: 9,
    font: fonts.regular,
    color: rgb(0.45, 0.45, 0.45),
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 52 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 52 },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
  });

  return PAGE_HEIGHT - MARGIN - 70;
}

function drawSummary(page: PDFPage, fonts: PdfFonts, input: PlanPdfInput, y: number) {
  const stats = [
    ["Completed Credits", String(input.completedCredits)],
    ["Planned Credits", String(input.plannedCredits)],
    ["Total Required", String(input.totalCredits)],
    ["Cumulative GPA", input.profile.gpa ?? "N/A"],
    ["Entry Term", input.profile.entryLabel ?? "N/A"],
    ["Expected Graduation", input.profile.gradLabel ?? "N/A"],
  ];

  let x = MARGIN;
  let currentY = y;
  stats.forEach(([label, value], index) => {
    drawStatCard(page, fonts, x, currentY, label, value);
    x += 170;
    if ((index + 1) % 3 === 0) {
      x = MARGIN;
      currentY -= 56;
    }
  });

  return currentY - 10;
}

function drawStatCard(page: PDFPage, fonts: PdfFonts, x: number, y: number, label: string, value: string) {
  page.drawRectangle({
    x,
    y: y - 38,
    width: 158,
    height: 44,
    borderWidth: 0.8,
    borderColor: rgb(0.83, 0.83, 0.83),
    color: rgb(0.985, 0.985, 0.985),
  });
  page.drawText(label.toUpperCase(), {
    x: x + 10,
    y: y - 8,
    size: 8,
    font: fonts.regular,
    color: rgb(0.45, 0.45, 0.45),
  });
  page.drawText(value, {
    x: x + 10,
    y: y - 26,
    size: 14,
    font: fonts.bold,
    color: rgb(0.1, 0.1, 0.1),
  });
}

function drawSemesterBlock(
  page: PDFPage,
  fonts: PdfFonts,
  input: PlanPdfInput,
  semester: Semester,
  y: number
) {
  const semesterCourses = semester.courseIds
    .map((courseId) => input.planCatalog[courseId])
    .filter((course): course is Course => Boolean(course));
  const credits = semesterCourses.reduce((total, course) => total + (course.credits ?? 0), 0);
  const headerHeight = 22;
  const tableHeaderHeight = 18;
  const tableHeight = Math.max(semesterCourses.length, 1) * TABLE_ROW_HEIGHT;
  const blockHeight = headerHeight + tableHeaderHeight + tableHeight;

  page.drawRectangle({
    x: MARGIN,
    y: y - blockHeight,
    width: PAGE_WIDTH - MARGIN * 2,
    height: blockHeight,
    borderWidth: 0.8,
    borderColor: rgb(0.82, 0.82, 0.82),
    color: rgb(1, 1, 1),
  });
  page.drawRectangle({
    x: MARGIN,
    y: y - headerHeight,
    width: PAGE_WIDTH - MARGIN * 2,
    height: headerHeight,
    color: semester.isCurrent ? rgb(0.9, 0.94, 1) : semester.isPast ? rgb(0.95, 0.95, 0.95) : rgb(0.975, 0.975, 0.975),
  });
  page.drawText(`${semester.term} ${semester.year}`, {
    x: MARGIN + 10,
    y: y - 14,
    size: 11,
    font: fonts.bold,
    color: rgb(0.08, 0.08, 0.08),
  });
  page.drawText(`${credits} credits`, {
    x: PAGE_WIDTH - MARGIN - 62,
    y: y - 14,
    size: 9,
    font: fonts.regular,
    color: rgb(0.35, 0.35, 0.35),
  });

  const tableTop = y - headerHeight;
  drawTableHeader(page, fonts, tableTop);
  let rowY = tableTop - 13;
  semesterCourses.forEach((course, index) => {
    if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: rowY - 5,
        width: PAGE_WIDTH - MARGIN * 2,
        height: TABLE_ROW_HEIGHT,
        color: rgb(0.99, 0.99, 0.99),
      });
    }
    drawCourseRow(page, fonts, course, rowY);
    rowY -= TABLE_ROW_HEIGHT;
  });

  return y - blockHeight - 14;
}

function drawTableHeader(page: PDFPage, fonts: PdfFonts, y: number) {
  page.drawRectangle({
    x: MARGIN,
    y: y - 18,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 18,
    color: rgb(0.965, 0.965, 0.965),
  });
  const headers: Array<[string, number]> = [
    ["Code", MARGIN + 8],
    ["Course Title", MARGIN + 82],
    ["Cr", MARGIN + 350],
    ["Grade", MARGIN + 392],
    ["Type", MARGIN + 442],
    ["Status", MARGIN + 490],
  ];
  headers.forEach(([label, x]) => {
    page.drawText(label, {
      x,
      y: y - 11,
      size: 8,
      font: fonts.bold,
      color: rgb(0.42, 0.42, 0.42),
    });
  });
}

function drawCourseRow(page: PDFPage, fonts: PdfFonts, course: Course, y: number) {
  page.drawText(course.code, {
    x: MARGIN + 8,
    y,
    size: 8.5,
    font: fonts.bold,
    color: rgb(0.08, 0.08, 0.08),
  });
  page.drawText(truncate(course.title, fonts.regular, 8.5, 248), {
    x: MARGIN + 82,
    y,
    size: 8.5,
    font: fonts.regular,
    color: rgb(0.08, 0.08, 0.08),
  });
  page.drawText(String(course.credits ?? ""), {
    x: MARGIN + 355,
    y,
    size: 8.5,
    font: fonts.regular,
    color: rgb(0.08, 0.08, 0.08),
  });
  page.drawText(course.grade ?? "-", {
    x: MARGIN + 395,
    y,
    size: 8.5,
    font: fonts.regular,
    color: rgb(0.08, 0.08, 0.08),
  });
  page.drawText(LABEL_BADGE[course.label], {
    x: MARGIN + 445,
    y,
    size: 8.5,
    font: fonts.regular,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText(formatStatus(course.status), {
    x: MARGIN + 490,
    y,
    size: 8.5,
    font: fonts.regular,
    color: rgb(0.08, 0.08, 0.08),
  });
}

function drawFooter(page: PDFPage, fonts: PdfFonts, printDate: string, pageNumber: number) {
  page.drawLine({
    start: { x: MARGIN, y: 40 },
    end: { x: PAGE_WIDTH - MARGIN, y: 40 },
    thickness: 0.8,
    color: rgb(0.8, 0.8, 0.8),
  });
  page.drawText(`Generated by FiskGrad on ${printDate}`, {
    x: MARGIN,
    y: 24,
    size: 7.5,
    font: fonts.regular,
    color: rgb(0.45, 0.45, 0.45),
  });
  page.drawText(`Page ${pageNumber}`, {
    x: PAGE_WIDTH - MARGIN - 32,
    y: 24,
    size: 7.5,
    font: fonts.regular,
    color: rgb(0.45, 0.45, 0.45),
  });
}

function formatStatus(status: Course["status"]) {
  if (status === "completed") return "Done";
  if (status === "failed") return "Failed";
  return "Planned";
}

function truncate(value: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let next = value;
  while (next.length > 0 && font.widthOfTextAtSize(`${next}...`, size) > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}...`;
}
