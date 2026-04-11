import accountingTemplate from "../data/accounting_requirements.json";
import businessAdminNonTemplate from "../data/business_admin_non_concentration_requirements.json";
import businessInfoSystemsTemplate from "../data/business_information_systems_as_requirements.json";
import csTemplate from "../data/cs_requirements.json";
import financeEconomicsTemplate from "../data/finance_economics_requirements.json";
import managementTemplate from "../data/management_requirements.json";
import marketingTemplate from "../data/marketing_requirements.json";
import mathematicsTemplate from "../data/mathematics_ba_requirements.json";
import musicBusinessTemplate from "../data/music_business_requirements.json";
import physicsTemplate from "../data/physics_requirements.json";

export type TemplateCredits = number | { min?: number | null; max?: number | null } | null;

export interface TemplateCourse {
  course_code: string;
  course_name?: string;
  credits?: number | null;
  alternative_for?: string;
  satisfies_requirement?: string;
  requires_corequisite?: string;
  corequisite_for?: string;
}

export interface TemplateRequirementGroup {
  group_id: string;
  group_name: string;
  group_type: string;
  credits_required?: TemplateCredits;
  description?: string;
  notes?: string;
  selection_count?: number;
  courses?: TemplateCourse[];
}

export interface MajorTemplate {
  major_code: string;
  major_name: string;
  degree_type?: string;
  total_credits_required?: number | null;
  requirement_groups: TemplateRequirementGroup[];
}

export interface BalanceSheetGroupConfig {
  displayName?: string;
  sectionTone?: "core" | "major" | "elective" | "general";
  defaultExpanded?: boolean;
  hidden?: boolean;
}

export interface MajorBalanceSheetConfig {
  majorCode: string;
  template: MajorTemplate;
  layoutVariant: "standard" | "business";
  sheetTitle: string;
  sourceLabel: string;
  printNotes?: string[];
  groupOrder?: string[];
  editableByMajor: true;
  groupConfig?: Record<string, BalanceSheetGroupConfig>;
}

export const BALANCE_SHEET_TEMPLATE_CONFIG: Record<string, MajorBalanceSheetConfig> = {
  ACC: {
    majorCode: "ACC",
    template: accountingTemplate as MajorTemplate,
    layoutVariant: "business",
    sheetTitle: "Accounting Advisor Balance Sheet",
    sourceLabel: "Accounting template",
    printNotes: [
      "Use this sheet for advisor review of completed, planned, and open accounting requirements.",
      "Math options satisfying CORE 131 and BAD 110 or CSCI 100 should be treated as requirement alternatives, not duplicate requirements.",
    ],
    groupOrder: [
      "core_fixed",
      "core_group_a",
      "core_group_b",
      "core_group_c",
      "core_group_d",
      "core_group_e",
      "foreign_language",
      "required_cognates_stats",
      "required_cognates_calculus",
      "major_requirements",
      "accounting_concentration_fixed",
      "accounting_concentration_electives",
      "general_electives",
    ],
    editableByMajor: true,
    groupConfig: {
      core_fixed: { sectionTone: "core", defaultExpanded: true },
      core_group_b: { sectionTone: "core", defaultExpanded: false },
      major_requirements: { sectionTone: "major", defaultExpanded: true },
      accounting_concentration_fixed: { sectionTone: "major", defaultExpanded: true },
      accounting_concentration_electives: { sectionTone: "elective", defaultExpanded: true },
      general_electives: { sectionTone: "general", defaultExpanded: false },
    },
  },
  "BAD-NON": {
    majorCode: "BAD-NON",
    template: businessAdminNonTemplate as MajorTemplate,
    layoutVariant: "business",
    sheetTitle: "Business Administration Balance Sheet",
    sourceLabel: "Business administration template",
    printNotes: [
      "This sheet reflects the non-concentration business administration path only.",
      "Group B is carried on the source sheet as satisfied by required cognates and may not require separate advisor marking.",
    ],
    groupOrder: [
      "core_fixed",
      "core_group_a",
      "core_group_b",
      "core_group_c",
      "core_group_d",
      "core_group_e",
      "foreign_language",
      "required_cognates",
      "major_requirements",
      "general_electives",
    ],
    editableByMajor: true,
    groupConfig: {
      core_fixed: { sectionTone: "core", defaultExpanded: true },
      core_group_b: { sectionTone: "core", defaultExpanded: false },
      major_requirements: { sectionTone: "major", defaultExpanded: true },
      general_electives: { sectionTone: "general", defaultExpanded: false },
    },
  },
  "BIS-AS": {
    majorCode: "BIS-AS",
    template: businessInfoSystemsTemplate as MajorTemplate,
    layoutVariant: "business",
    sheetTitle: "Business Information Systems Balance Sheet",
    sourceLabel: "Business information systems template",
    printNotes: ["Review this sheet against the approved BIS A.S. balance sheet for advisor sign-off."],
    editableByMajor: true,
  },
  CSCI: {
    majorCode: "CSCI",
    template: csTemplate as MajorTemplate,
    layoutVariant: "standard",
    sheetTitle: "Computer Science Advisor Balance Sheet",
    sourceLabel: "Computer science template",
    printNotes: [
      "Computer science major requirements include several lecture and lab pairings that should be reviewed together.",
      "Major elective credit should be checked against department-approved 200-level or above CSCI electives.",
    ],
    groupOrder: [
      "core_fixed",
      "core_group_a",
      "core_group_c",
      "core_group_d",
      "core_group_e",
      "foreign_language",
      "cognates",
      "major_requirements",
      "major_electives",
      "general_electives",
    ],
    editableByMajor: true,
    groupConfig: {
      core_fixed: { sectionTone: "core", defaultExpanded: true },
      cognates: { sectionTone: "major", defaultExpanded: true },
      major_requirements: { sectionTone: "major", defaultExpanded: true },
      major_electives: { sectionTone: "elective", defaultExpanded: true },
      general_electives: { sectionTone: "general", defaultExpanded: false },
    },
  },
  "FIN-ECON": {
    majorCode: "FIN-ECON",
    template: financeEconomicsTemplate as MajorTemplate,
    layoutVariant: "business",
    sheetTitle: "Finance Economics Balance Sheet",
    sourceLabel: "Finance economics template",
    printNotes: ["Use the finance economics source sheet as the authority for advisor-facing review."],
    editableByMajor: true,
  },
  MGT: {
    majorCode: "MGT",
    template: managementTemplate as MajorTemplate,
    layoutVariant: "business",
    sheetTitle: "Management Balance Sheet",
    sourceLabel: "Management template",
    printNotes: ["Use the management balance sheet for advisor-facing review of completed and planned major requirements."],
    editableByMajor: true,
  },
  MKT: {
    majorCode: "MKT",
    template: marketingTemplate as MajorTemplate,
    layoutVariant: "business",
    sheetTitle: "Marketing Balance Sheet",
    sourceLabel: "Marketing template",
    printNotes: ["Use the marketing source sheet as the reference structure for advisor-facing review."],
    editableByMajor: true,
  },
  MATH: {
    majorCode: "MATH",
    template: mathematicsTemplate as MajorTemplate,
    layoutVariant: "standard",
    sheetTitle: "Mathematics Advisor Balance Sheet",
    sourceLabel: "Mathematics template",
    printNotes: ["Use the mathematics source sheet as the academic advising reference for required and elective math coursework."],
    editableByMajor: true,
  },
  "MUSIC-BIZ": {
    majorCode: "MUSIC-BIZ",
    template: musicBusinessTemplate as MajorTemplate,
    layoutVariant: "business",
    sheetTitle: "Music Business Balance Sheet",
    sourceLabel: "Music business template",
    printNotes: ["Use the music business source sheet as the advising reference for the supported major path."],
    editableByMajor: true,
  },
  PHYS: {
    majorCode: "PHYS",
    template: physicsTemplate as MajorTemplate,
    layoutVariant: "standard",
    sheetTitle: "Physics Advisor Balance Sheet",
    sourceLabel: "Physics template",
    printNotes: ["Use the physics source sheet as the advising reference for lecture/lab pairings and elective requirements."],
    editableByMajor: true,
  },
};

export function getMajorBalanceSheetConfig(majorCode: string | null | undefined): MajorBalanceSheetConfig | null {
  if (!majorCode) return null;
  return BALANCE_SHEET_TEMPLATE_CONFIG[majorCode.toUpperCase()] ?? null;
}
