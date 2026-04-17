import type { Course, Semester } from "@/lib/data";
import {
  getMajorBalanceSheetConfig,
  type BalanceSheetGroupConfig,
  type MajorTemplate,
  type TemplateCredits,
  type TemplateRequirementGroup,
} from "@/lib/balance-sheet-templates";

export interface BalanceSheetRow {
  kind: "course";
  code: string;
  name: string;
  templateCredits: number | null;
  actualCredits: number | null;
  status: "completed" | "planned" | "empty";
  grade: string | null;
  termCode: string | null;
  annotations: string[];
}

export interface BalanceSheetNoteRow {
  kind: "note";
  text: string;
}

export interface BalanceSheetBucketRow {
  kind: "bucket";
  label: string;
  description: string | null;
  creditsRequiredText: string | null;
}

export interface BalanceSheetChoiceSummaryRow {
  kind: "choice_summary";
  text: string;
}

export interface BalanceSheetCoursePairRow {
  kind: "course_pair";
  relationship: "corequisite" | "alternative" | "satisfaction";
  label: string;
  courses: BalanceSheetRow[];
}

export type BalanceSheetRenderableRow =
  | BalanceSheetRow
  | BalanceSheetNoteRow
  | BalanceSheetBucketRow
  | BalanceSheetChoiceSummaryRow
  | BalanceSheetCoursePairRow;

export interface BalanceSheetGroupView {
  id: string;
  name: string;
  displayName: string;
  type: string;
  description: string | null;
  notes: string | null;
  creditsRequiredText: string | null;
  renderMode: "course_list" | "bucket" | "notes_only";
  sectionTone: "core" | "major" | "elective" | "general";
  defaultExpanded: boolean;
  hidden: boolean;
  rows: BalanceSheetRenderableRow[];
  completedCount: number;
  plannedCount: number;
  completedCredits: number;
  plannedCredits: number;
  requiredCredits: number | null;
  isCreditBased: boolean;
  isSatisfied: boolean;
  progressLabel: string;
}

export interface BalanceSheetViewModel {
  majorCode: string;
  majorName: string;
  degreeType: string | null;
  totalCreditsRequired: number | null;
  layoutVariant: "standard" | "business";
  sheetTitle: string;
  sourceLabel: string;
  printNotes: string[];
  groups: BalanceSheetGroupView[];
  completedRows: number;
  plannedRows: number;
}

function normalizeCode(code: string): string {
  return code.replace(/[-\s]+/g, " ").trim().toUpperCase();
}

function courseMatchesGroupRule(code: string, group: TemplateRequirementGroup): boolean {
  const rule = group.rules;
  if (!rule?.subject_code || !rule.min_level) return false;
  const normalized = normalizeCode(code);
  if (rule.exclude_courses?.some((excluded) => normalizeCode(excluded) === normalized)) return false;
  const [subject, rawNumber = ""] = normalized.split(" ");
  if (subject !== rule.subject_code.toUpperCase()) return false;
  const level = Number.parseInt(rawNumber.replace(/\D/g, ""), 10);
  if (!Number.isFinite(level)) return false;
  return level >= rule.min_level && (rule.max_level == null || level <= rule.max_level);
}

function shortTermCode(term: string, year: number): string {
  const codeMap: Record<string, string> = {
    spring: "SP",
    summer: "SU",
    fall: "FA",
    winter: "WI",
  };
  const prefix = codeMap[term.toLowerCase()] ?? term.slice(0, 2).toUpperCase();
  return `${prefix}${String(year).slice(-2)}`;
}

function formatCreditsRequired(value: TemplateCredits): string | null {
  if (typeof value === "number") return `${value} cr`;
  if (!value || typeof value !== "object") return null;
  const min = value.min ?? null;
  const max = value.max ?? null;
  if (min != null && max != null) return `${min}-${max} cr`;
  if (min != null) return `${min}+ cr`;
  if (max != null) return `Up to ${max} cr`;
  return null;
}

function getCreditsRequiredMin(value: TemplateCredits): number | null {
  if (typeof value === "number") return value;
  if (!value || typeof value !== "object") return null;
  return value.min ?? value.max ?? null;
}

function buildCoursePlacementMap(
  semesters: Semester[],
  planCatalog: Record<string, Course>
): Record<string, { status: "completed" | "planned"; grade: string | null; termCode: string; credits: number | null }> {
  const placements: Record<string, { status: "completed" | "planned"; grade: string | null; termCode: string; credits: number | null }> = {};

  semesters.forEach((semester) => {
    semester.courseIds.forEach((code) => {
      const course = planCatalog[code];
      if (!course) return;
      placements[normalizeCode(code)] = {
        status: course.status === "completed" ? "completed" : "planned",
        grade: course.grade ?? null,
        termCode: shortTermCode(semester.term, semester.year),
        credits: typeof course.credits === "number" && Number.isFinite(course.credits) ? course.credits : null,
      };
    });
  });

  return placements;
}

function getGroupRenderMode(group: TemplateRequirementGroup): BalanceSheetGroupView["renderMode"] {
  if ((group.courses?.length ?? 0) > 0) return "course_list";
  if (group.rules) return "course_list";
  if (group.group_type === "credit_threshold" || group.group_type === "fill_remaining") return "bucket";
  return "notes_only";
}

function formatGroupProgress(groupType: string, completedCredits: number, requiredCredits: number | null, completedCount: number, rowCount: number): string {
  if ((groupType === "credit_threshold" || groupType === "fill_remaining") && requiredCredits != null) {
    return `${Math.min(completedCredits, requiredCredits)}/${requiredCredits} cr`;
  }
  return `${completedCount}/${rowCount} rows`;
}

function resolveGroupConfig(group: TemplateRequirementGroup, config?: BalanceSheetGroupConfig): Pick<BalanceSheetGroupView, "displayName" | "sectionTone" | "defaultExpanded" | "hidden"> {
  const derivedTone =
    config?.sectionTone ??
    (group.group_id.includes("core")
      ? "core"
      : group.group_id.includes("major") || group.group_id.includes("cognates")
      ? "major"
      : group.group_id.includes("elective")
      ? "elective"
      : "general");

  return {
    displayName: config?.displayName ?? group.group_name,
    sectionTone: derivedTone,
    defaultExpanded: config?.defaultExpanded ?? (derivedTone !== "general"),
    hidden: config?.hidden ?? false,
  };
}

function sortGroups(groups: BalanceSheetGroupView[], preferredOrder: string[] | undefined): BalanceSheetGroupView[] {
  if (!preferredOrder?.length) return groups;
  const orderIndex = new Map(preferredOrder.map((id, index) => [id, index]));
  return [...groups].sort((a, b) => {
    const aIndex = orderIndex.get(a.id);
    const bIndex = orderIndex.get(b.id);
    if (aIndex == null && bIndex == null) return a.name.localeCompare(b.name);
    if (aIndex == null) return 1;
    if (bIndex == null) return -1;
    return aIndex - bIndex;
  });
}

function groupCourseRows(rows: BalanceSheetRow[]): BalanceSheetRenderableRow[] {
  const byCode = new Map(rows.map((row) => [normalizeCode(row.code), row]));
  const consumed = new Set<string>();
  const renderRows: BalanceSheetRenderableRow[] = [];
  const satisfactionGroups = new Map<string, BalanceSheetRow[]>();

  for (const row of rows) {
    const satisfies = row.annotations.find((item) => item.startsWith("Satisfies "));
    if (!satisfies) continue;
    const requirement = satisfies.replace("Satisfies ", "");
    const bucket = satisfactionGroups.get(requirement) ?? [];
    bucket.push(row);
    satisfactionGroups.set(requirement, bucket);
  }

  for (const [requirement, groupedRows] of satisfactionGroups.entries()) {
    if (groupedRows.length < 2) continue;
    groupedRows.forEach((row) => consumed.add(normalizeCode(row.code)));
    renderRows.push({
      kind: "course_pair",
      relationship: "satisfaction",
      label: `${requirement} can be satisfied by one of these courses`,
      courses: groupedRows,
    });
  }

  for (const row of rows) {
    const key = normalizeCode(row.code);
    if (consumed.has(key)) continue;

    const requiresCoreq = row.annotations.find((item) => item.startsWith("Requires "));
    if (requiresCoreq) {
      const targetCode = requiresCoreq.replace("Requires ", "");
      const target = byCode.get(normalizeCode(targetCode));
      if (target && !consumed.has(normalizeCode(target.code))) {
        consumed.add(key);
        consumed.add(normalizeCode(target.code));
        renderRows.push({
          kind: "course_pair",
          relationship: "corequisite",
          label: `${row.code} + ${target.code}`,
          courses: [row, target],
        });
        continue;
      }
    }

    const alternativeFor = row.annotations.find((item) => item.startsWith("Alternative for "));
    if (alternativeFor) {
      const targetCode = alternativeFor.replace("Alternative for ", "");
      const target = byCode.get(normalizeCode(targetCode));
      if (target && !consumed.has(normalizeCode(target.code))) {
        consumed.add(key);
        consumed.add(normalizeCode(target.code));
        renderRows.push({
          kind: "course_pair",
          relationship: "alternative",
          label: `${target.code} or ${row.code}`,
          courses: [target, row],
        });
        continue;
      }
    }

    consumed.add(key);
    renderRows.push(row);
  }

  return renderRows;
}

export function getMajorBalanceSheetTemplate(majorCode: string | null | undefined): MajorTemplate | null {
  return getMajorBalanceSheetConfig(majorCode)?.template ?? null;
}

export function buildBalanceSheetViewModel(
  majorCode: string | null | undefined,
  semesters: Semester[],
  planCatalog: Record<string, Course>
): BalanceSheetViewModel | null {
  const config = getMajorBalanceSheetConfig(majorCode);
  const template = config?.template ?? null;
  if (!template) return null;

  const placements = buildCoursePlacementMap(semesters, planCatalog);

  const groups = template.requirement_groups.map((group) => {
    const groupConfig = resolveGroupConfig(group, config?.groupConfig?.[group.group_id]);
    const renderMode = getGroupRenderMode(group);
    const explicitCourses = group.courses ?? [];
    const explicitCodes = new Set(explicitCourses.map((course) => normalizeCode(course.course_code)));
    const ruleMatchedCourses = Object.values(planCatalog)
      .filter((course) => !explicitCodes.has(normalizeCode(course.code)) && courseMatchesGroupRule(course.code, group))
      .map((course) => ({
        course_code: course.code,
        course_name: course.title,
        credits: course.credits,
      }));

    const courseRows = [...explicitCourses, ...ruleMatchedCourses].map((course) => {
      const placement = placements[normalizeCode(course.course_code)];
      const annotations = [
        course.alternative_for ? `Alternative for ${course.alternative_for}` : null,
        course.satisfies_requirement ? `Satisfies ${course.satisfies_requirement}` : null,
        course.requires_corequisite ? `Requires ${course.requires_corequisite}` : null,
        course.corequisite_for ? `Co-req for ${course.corequisite_for}` : null,
      ].filter((value): value is string => Boolean(value));
      return {
        kind: "course",
        code: course.course_code,
        name: course.course_name ?? course.course_code,
        templateCredits: typeof course.credits === "number" ? course.credits : null,
        actualCredits: placement?.credits ?? (typeof course.credits === "number" ? course.credits : null),
        status: placement?.status ?? "empty",
        grade: placement?.grade ?? null,
        termCode: placement?.termCode ?? null,
        annotations,
      } satisfies BalanceSheetRow;
    });

    const groupedCourseRows = groupCourseRows(courseRows);
    const completedCredits = courseRows.reduce(
      (sum, row) => sum + (row.status === "completed" ? row.actualCredits ?? row.templateCredits ?? 0 : 0),
      0
    );
    const plannedCredits = courseRows.reduce(
      (sum, row) => sum + (row.status === "planned" ? row.actualCredits ?? row.templateCredits ?? 0 : 0),
      0
    );
    const requiredCredits = getCreditsRequiredMin(group.credits_required ?? null);
    const isCreditBased = group.group_type === "credit_threshold" || group.group_type === "fill_remaining";
    const completedCount = courseRows.filter((row) => row.status === "completed").length;
    const plannedCount = courseRows.filter((row) => row.status === "planned").length;
    const isSatisfied = isCreditBased && requiredCredits != null
      ? completedCredits >= requiredCredits
      : courseRows.length > 0 && courseRows.every((row) => row.status === "completed");

    const choiceSummary =
      group.group_type === "choose_n" && group.selection_count
        ? [{
            kind: "choice_summary",
            text: `Choose ${group.selection_count} course${group.selection_count === 1 ? "" : "s"} from this group.`,
          } satisfies BalanceSheetChoiceSummaryRow]
        : group.group_type === "choose_one"
        ? [{
            kind: "choice_summary",
            text: "Choose one course from this group.",
          } satisfies BalanceSheetChoiceSummaryRow]
        : [];

    const rows: BalanceSheetRenderableRow[] =
      renderMode === "course_list"
        ? [...choiceSummary, ...groupedCourseRows]
        : renderMode === "bucket"
        ? [{
            kind: "bucket",
            label: group.group_name,
            description: group.description ?? null,
            creditsRequiredText: formatCreditsRequired(group.credits_required ?? null),
          } satisfies BalanceSheetBucketRow]
        : [{
            kind: "note",
            text: group.notes ?? group.description ?? "No fixed course rows are defined for this group yet.",
          } satisfies BalanceSheetNoteRow];

    return {
      id: group.group_id,
      name: group.group_name,
      displayName: groupConfig.displayName,
      type: group.group_type,
      description: group.description ?? null,
      notes: group.notes ?? null,
      creditsRequiredText: formatCreditsRequired(group.credits_required ?? null),
      renderMode,
      sectionTone: groupConfig.sectionTone,
      defaultExpanded: groupConfig.defaultExpanded,
      hidden: groupConfig.hidden,
      rows,
      completedCount,
      plannedCount,
      completedCredits,
      plannedCredits,
      requiredCredits,
      isCreditBased,
      isSatisfied,
      progressLabel: formatGroupProgress(group.group_type, completedCredits, requiredCredits, completedCount, courseRows.length),
    } satisfies BalanceSheetGroupView;
  });

  const orderedGroups = sortGroups(groups, config?.groupOrder).filter((group) => !group.hidden);

  return {
    majorCode: template.major_code,
    majorName: template.major_name,
    degreeType: template.degree_type ?? null,
    totalCreditsRequired: template.total_credits_required ?? null,
    layoutVariant: config?.layoutVariant ?? "standard",
    sheetTitle: config?.sheetTitle ?? `${template.major_name} Balance Sheet`,
    sourceLabel: config?.sourceLabel ?? "Major template",
    printNotes: config?.printNotes ?? [],
    groups: orderedGroups,
    completedRows: orderedGroups.reduce((sum, group) => sum + group.completedCount, 0),
    plannedRows: orderedGroups.reduce((sum, group) => sum + group.plannedCount, 0),
  };
}
