/**
 * Requirements engine — pure functions, no UI, no network calls.
 *
 * Data flow:
 *   plan-context (semesters + planCatalog + labels)
 *     └─ lib/requirements.ts  (buildRequirementsViewModel)
 *         └─ requirements-page.tsx  (renders the model, handles expand/collapse)
 */

import type { Semester, Course, RequirementLabel } from "@/lib/data";
import type { CourseLabelEntry } from "@/lib/api";

// ─── Output types ─────────────────────────────────────────────────────────────

export type CourseStatus = "completed" | "planned" | "missing";

export interface RequirementCourseRow {
  code: string;
  title: string;
  credits: number;
  status: CourseStatus;
  prereqs: string[];
}

/** One of the four top-level label buckets (required / group / elective / general). */
export interface RequirementGroup {
  courses: RequirementCourseRow[];
  completed: number;
  total: number;
}

/** A single requirement group from the major template (e.g. "Core CS Courses"). */
export interface AuditGroup {
  groupName: string;
  groupType: string;
  label: RequirementLabel;
  courses: RequirementCourseRow[];
  completedCredits: number;
  plannedCredits: number;
  totalCredits: number;
  requiredCredits: number | null;
  requiredCourses: number | null;
  isCreditBased: boolean;
  isSatisfied: boolean;
  progressLabel: string;
}

export interface RequirementsViewModel {
  /** Courses bucketed by label type. */
  groups: Record<RequirementLabel, RequirementGroup>;
  /** Requirement groups from the major template, sorted by label priority. */
  auditGroups: AuditGroup[];
  totalCreditsEarned: number;
}

// ─── Label mapping helper ─────────────────────────────────────────────────────

function mapLabel(label: string): RequirementLabel {
  if (label === "Required") return "required";
  if (label === "Group Choice") return "group";
  if (label === "Major Elective") return "elective";
  return "general";
}

function isCreditBasedGroup(groupType: string): boolean {
  return groupType === "credit_threshold" || groupType === "fill_remaining";
}

function getRequiredCredits(entry: CourseLabelEntry): number | null {
  return entry.credits_required_min ?? entry.credits_required_max ?? null;
}

function formatProgressLabel(group: Pick<AuditGroup, "completedCredits" | "plannedCredits" | "totalCredits" | "requiredCredits" | "requiredCourses" | "isCreditBased" | "courses">): string {
  if (group.isCreditBased && group.requiredCredits != null) {
    return `${Math.min(group.completedCredits, group.requiredCredits)}/${group.requiredCredits} cr`;
  }
  if (group.requiredCourses != null) {
    const completed = group.courses.filter((course) => course.status === "completed").length;
    return `${Math.min(completed, group.requiredCourses)}/${group.requiredCourses} courses`;
  }
  return `${group.completedCredits}/${group.totalCredits} cr`;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Builds the complete requirements view model from raw plan state.
 * Returns null when the plan hasn't loaded yet.
 */
export function buildRequirementsViewModel(
  semesters: Semester[],
  planCatalog: Record<string, Course>,
  labels: Record<string, CourseLabelEntry>
): RequirementsViewModel {
  const planCodes = new Set(semesters.flatMap((s) => s.courseIds));
  const completedIds = new Set([...planCodes].filter((id) => planCatalog[id]?.status === "completed"));
  const plannedIds = new Set([...planCodes].filter((id) => planCatalog[id]?.status !== "completed"));

  // ── Label buckets ────────────────────────────────────────────────────────
  const groups: Record<RequirementLabel, RequirementGroup> = {
    required: { courses: [], completed: 0, total: 0 },
    group: { courses: [], completed: 0, total: 0 },
    elective: { courses: [], completed: 0, total: 0 },
    general: { courses: [], completed: 0, total: 0 },
  };

  // Add courses that are already in the plan
  planCodes.forEach((code) => {
    const course = planCatalog[code];
    if (!course) return;
    const status: CourseStatus = completedIds.has(code) ? "completed" : "planned";
    groups[course.label].courses.push({
      code: course.code,
      title: course.title,
      credits: course.credits,
      status,
      prereqs: course.prereqs ?? [],
    });
    groups[course.label].total++;
    if (status === "completed") groups[course.label].completed++;
  });

  // Add required/template courses not yet in the plan (status = "missing")
  Object.entries(labels).forEach(([code, entry]) => {
    if (planCodes.has(code)) return;
    const groupLabel = mapLabel(entry.label);
    groups[groupLabel].courses.push({
      code,
      title: entry.detail || code,
      credits: entry.credits ?? 0,
      status: "missing",
      prereqs: [],
    });
    groups[groupLabel].total++;
  });

  // Sort each bucket alphabetically
  (Object.keys(groups) as RequirementLabel[]).forEach((label) => {
    groups[label].courses.sort((a, b) => a.code.localeCompare(b.code));
  });

  // ── Audit groups (per template group_name) ───────────────────────────────
  const auditMap: Record<string, AuditGroup> = {};

  Object.entries(labels).forEach(([code, entry]) => {
    const gKey = entry.group_name || "Other";
    if (!auditMap[gKey]) {
      auditMap[gKey] = {
        groupName: gKey,
        groupType: entry.group_type,
        label: mapLabel(entry.label),
        courses: [],
        completedCredits: 0,
        plannedCredits: 0,
        totalCredits: 0,
        requiredCredits: getRequiredCredits(entry),
        requiredCourses: entry.courses_required ?? null,
        isCreditBased: isCreditBasedGroup(entry.group_type),
        isSatisfied: false,
        progressLabel: "",
      };
    }
    const status: CourseStatus = completedIds.has(code)
      ? "completed"
      : plannedIds.has(code)
      ? "planned"
      : "missing";
    const cr = planCatalog[code]?.credits ?? entry.credits ?? 0;
    auditMap[gKey].courses.push({ code, title: entry.detail || code, credits: cr, status, prereqs: [] });
    auditMap[gKey].totalCredits += cr;
    if (status === "completed") auditMap[gKey].completedCredits += cr;
    if (status === "planned") auditMap[gKey].plannedCredits += cr;
  });

  // Sort courses within each audit group
  Object.values(auditMap).forEach((g) => {
    g.courses.sort((a, b) => a.code.localeCompare(b.code));
    const completedCourses = g.courses.filter((course) => course.status === "completed").length;
    if (g.isCreditBased && g.requiredCredits != null) {
      g.totalCredits = g.requiredCredits;
      g.isSatisfied = g.completedCredits >= g.requiredCredits;
    } else if (g.requiredCourses != null) {
      g.isSatisfied = completedCourses >= g.requiredCourses;
    } else {
      g.isSatisfied = g.courses.length > 0 && g.courses.every((course) => course.status === "completed");
    }
    g.progressLabel = formatProgressLabel(g);
  });

  // Sort audit groups by label priority
  const labelOrder: RequirementLabel[] = ["required", "group", "elective", "general"];
  const auditGroups = Object.values(auditMap).sort(
    (a, b) => labelOrder.indexOf(a.label) - labelOrder.indexOf(b.label)
  );

  // ── Credits earned ───────────────────────────────────────────────────────
  const totalCreditsEarned = [...planCodes].reduce((acc, id) => {
    const course = planCatalog[id];
    return course?.status === "completed" ? acc + course.credits : acc;
  }, 0);

  return { groups, auditGroups, totalCreditsEarned };
}
