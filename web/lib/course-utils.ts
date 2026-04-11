/**
 * Course utility functions — pure helpers shared across feature engines.
 *
 * Intentionally has no UI imports, no network calls, no React dependencies.
 * Imported by: plan-context, lib/transcript
 */

import type { CourseLabelEntry, ElectiveRule } from "@/lib/api";
import type { RequirementLabel, SemesterTerm } from "@/lib/data";

// ─── Code parsing ─────────────────────────────────────────────────────────────

export function parseCodeParts(code: string): { subject: string; level: 100 | 200 | 300 | 400 } {
  const match = code.match(/^([A-Za-z]+)[- ]?(\d+)/);
  const subject = match?.[1] ?? code;
  const num = parseInt(match?.[2] ?? "100", 10);
  const lvl = Math.floor(num / 100) * 100;
  const level = (lvl >= 100 && lvl <= 400 ? lvl : 100) as 100 | 200 | 300 | 400;
  return { subject, level };
}

export function normalizeCourseCode(code: string): string {
  return code.replace(/[-\s]+/g, " ").trim().toUpperCase();
}

// ─── Label resolution ─────────────────────────────────────────────────────────

function mapBackendLabel(entry: CourseLabelEntry | undefined): RequirementLabel {
  if (!entry) return "general";
  const map: Record<string, RequirementLabel> = {
    Required: "required",
    "Group Choice": "group",
    "Major Elective": "elective",
    "General Elective": "general",
  };
  return map[entry.label] ?? "general";
}

/**
 * Mirrors the backend get_course_label logic.
 * First checks the explicit labels dict; if not found, walks the elective rules
 * to determine if the course qualifies as a Major Elective by subject+level.
 */
export function resolveLabel(
  code: string,
  labels: Record<string, CourseLabelEntry>,
  rules: ElectiveRule[]
): RequirementLabel {
  const normalizedCode = normalizeCourseCode(code);

  for (const [labelCode, entry] of Object.entries(labels)) {
    if (normalizeCourseCode(labelCode) === normalizedCode) {
      return mapBackendLabel(entry);
    }
  }

  const { subject, level } = parseCodeParts(normalizedCode);

  for (const rule of rules) {
    if (
      subject.toUpperCase() === rule.subject_code.toUpperCase() &&
      level >= rule.min_level &&
      (rule.max_level == null || level <= rule.max_level) &&
      !rule.exclude_courses.some((excluded) => normalizeCourseCode(excluded) === normalizedCode)
    ) {
      return "elective";
    }
  }

  return "general";
}

// ─── Term normalization ───────────────────────────────────────────────────────

export function capitalizeTerm(t: string): SemesterTerm {
  const first = (t ?? "").split(/[\s_-]/)[0].toLowerCase();
  const map: Record<string, SemesterTerm> = {
    fall: "Fall",
    spring: "Spring",
    summer: "Summer",
    winter: "Winter",
  };
  return map[first] ?? "Fall";
}
