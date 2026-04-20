"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  FileSpreadsheet,
  Printer,
  Download,
  Upload,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  AlertCircle,
  FileUp,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn, formatDisplayName } from "@/lib/utils";
import { usePlan } from "@/contexts/plan-context";
import {
  buildBalanceSheetViewModel,
  type BalanceSheetGroupView,
  type BalanceSheetCoursePairRow,
  type BalanceSheetRenderableRow,
  type BalanceSheetRow,
  type BalanceSheetViewModel,
} from "@/lib/balance-sheet";
import { fillCustomBalanceSheetDOCX, scanCustomBalanceSheetPDF, type BalanceSheetFillRow, type BalanceSheetPdfMatch } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { downloadBlob, downloadPdf, fillBalanceSheetPdf, fillCustomBalanceSheetPdf } from "@/lib/pdf-fill";
import { toast } from "sonner";

const STATUS_META = {
  completed: {
    icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
    text: "Completed",
    pill: "bg-green-50 text-green-700",
  },
  planned: {
    icon: <Circle className="w-4 h-4 text-primary" />,
    text: "Planned",
    pill: "bg-primary/10 text-primary",
  },
  empty: {
    icon: <AlertCircle className="w-4 h-4 text-muted-foreground" />,
    text: "Open",
    pill: "bg-muted text-muted-foreground",
  },
} as const;

const GROUP_TYPE_LABEL: Record<string, string> = {
  all_of: "All required",
  choose_one: "Choose one",
  choose_n: "Choose some",
  credit_threshold: "Credit minimum",
  fill_remaining: "Elective fill",
  bucket: "Elective bucket",
};

const GROUP_TONE_STYLES = {
  core: "bg-sky-50 text-sky-700 border-sky-200",
  major: "bg-emerald-50 text-emerald-700 border-emerald-200",
  elective: "bg-amber-50 text-amber-700 border-amber-200",
  general: "bg-muted text-muted-foreground border-border",
} as const;

type RowOverride = Partial<Pick<BalanceSheetRow, "status" | "grade" | "termCode" | "actualCredits">>;
type RowOverrideMap = Record<string, RowOverride>;

export default function BalanceSheetPage() {
  const { accessToken } = useAuth();
  const { profile, semesters, planCatalog, majors, degreeCreditTotal, loading } = usePlan();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [source, setSource] = useState<"system" | "custom">("system");
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customFileUrl, setCustomFileUrl] = useState<string | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCustomPdf, setExportingCustomPdf] = useState(false);
  const [customScanLoading, setCustomScanLoading] = useState(false);
  const [customMatches, setCustomMatches] = useState<BalanceSheetPdfMatch[]>([]);
  const [customUnmatchedCount, setCustomUnmatchedCount] = useState(0);
  const [customScanMethod, setCustomScanMethod] = useState<"text" | "ocr" | "docx" | null>(null);
  const [customScanConfidence, setCustomScanConfidence] = useState(0);
  const [customDocxPreviewLines, setCustomDocxPreviewLines] = useState<string[]>([]);
  const [rowOverrides, setRowOverrides] = useState<RowOverrideMap>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const model = useMemo(
    () => buildBalanceSheetViewModel(profile?.major_code, semesters, planCatalog),
    [profile?.major_code, semesters, planCatalog]
  );
  const workingModel = useMemo(
    () => applyBalanceSheetOverrides(model, rowOverrides),
    [model, rowOverrides]
  );
  const templateCourseCodes = useMemo(
    () => getTemplateCourseCodes(model?.groups ?? []),
    [model?.groups]
  );

  const majorName = formatDisplayName(
    majors.find((m) => m.code === profile?.major_code)?.name
      ?? profile?.major_code
      ?? null
  );
  const studentName = profile?.name?.trim() || "Student";
  const isBusinessLayout = model?.layoutVariant === "business";

  const creditsEarned = useMemo(
    () => semesters.flatMap((s) => s.courseIds).reduce((sum, code) => {
      const c = planCatalog[code];
      return c?.status === "completed" ? sum + (c.credits ?? 0) : sum;
    }, 0),
    [semesters, planCatalog]
  );
  const workingCreditsEarned = useMemo(
    () => getUniqueCompletedCredits(workingModel?.groups ?? []) ?? creditsEarned,
    [workingModel?.groups, creditsEarned]
  );

  const entryLabel = profile?.start_term && profile?.start_year
    ? `${profile.start_term.charAt(0).toUpperCase()}${profile.start_term.slice(1)} ${profile.start_year}`
    : null;
  const gradLabel = profile?.graduation_term && profile?.graduation_year
    ? `${profile.graduation_term.charAt(0).toUpperCase()}${profile.graduation_term.slice(1)} ${profile.graduation_year}`
    : null;

  const handleDownloadPdf = async () => {
    if (!workingModel) return;

    setExportingPdf(true);
    try {
      const pdfBytes = await fillBalanceSheetPdf({
        studentName,
        majorCode: workingModel.majorCode,
        majorName: majorName ?? workingModel.majorName,
        gpa: profile?.gpa != null ? Number(profile.gpa) : null,
        entryLabel,
        gradLabel,
        creditsEarned: workingCreditsEarned,
        creditsRequired: workingModel.totalCreditsRequired ?? degreeCreditTotal,
        degreeType: workingModel.degreeType ?? "B.S.",
        groups: workingModel.groups,
        printNotes: workingModel.printNotes,
        printDate: new Date().toLocaleDateString(),
      });
      downloadPdf(pdfBytes, `${safeFilePart(studentName)}-degree-audit.pdf`);
    } catch {
      toast.error("Could not generate the degree audit PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const isDocxFile = (f: File) =>
    f.name.toLowerCase().endsWith(".docx") ||
    f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const handleDownloadFilledCustomPdf = async () => {
    if (!customFile || !workingModel) return;
    if (isDocxFile(customFile) && !accessToken) {
      toast.error("Sign in again before exporting the filled Word document.");
      return;
    }

    if (customMatches.length === 0) {
      toast.error("No course codes were found in that file. Nothing to export.");
      return;
    }

    setExportingCustomPdf(true);
    try {
      let pdfBytes: Uint8Array;

      if (isDocxFile(customFile)) {
        if (!accessToken) {
          toast.error("Sign in again before exporting the filled Word document.");
          return;
        }
        const filledDocx = await fillCustomBalanceSheetDOCX(
          customFile,
          accessToken,
          getFillRows(workingModel.groups)
        );
        downloadBlob(filledDocx, `${safeFilePart(studentName)}-balance-sheet-filled.docx`);
        return;
      } else {
        // PDF: write marks directly into the original file
        pdfBytes = await fillCustomBalanceSheetPdf({
          file: customFile,
          matches: customMatches,
          groups: workingModel.groups,
        });
      }

      downloadPdf(pdfBytes, `${safeFilePart(studentName)}-balance-sheet-filled.pdf`);
    } catch {
      toast.error("Could not export the filled balance sheet");
    } finally {
      setExportingCustomPdf(false);
    }
  };

  useEffect(() => {
    if (!customFile) {
      setCustomFileUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setCustomMatches([]);
      setCustomUnmatchedCount(0);
      setCustomScanMethod(null);
      setCustomScanConfidence(0);
      setCustomDocxPreviewLines([]);
      return;
    }

    const nextUrl = URL.createObjectURL(customFile);
    setCustomFileUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextUrl;
    });

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [customFile]);

  useEffect(() => {
    const isScannable = customFile && (
      customFile.type === "application/pdf" ||
      customFile.name.toLowerCase().endsWith(".pdf") ||
      customFile.name.toLowerCase().endsWith(".docx") ||
      customFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    if (!isScannable || !accessToken || templateCourseCodes.length === 0) {
      setCustomMatches([]);
      setCustomUnmatchedCount(0);
      setCustomScanMethod(null);
      setCustomScanConfidence(0);
      setCustomDocxPreviewLines([]);
      return;
    }

    let cancelled = false;
    setCustomScanLoading(true);
    scanCustomBalanceSheetPDF(customFile, accessToken, templateCourseCodes)
      .then((result) => {
        if (cancelled) return;
        setCustomMatches(result.matches);
        setCustomUnmatchedCount(result.unmatched_codes.length);
        setCustomScanMethod(result.method);
        setCustomScanConfidence(result.confidence);
        setCustomDocxPreviewLines(result.method === "docx" ? result.preview_lines ?? [] : []);
        if (result.matches.length === 0) {
          toast.warning(result.warning ?? "No course codes were found in that file.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setCustomMatches([]);
        setCustomUnmatchedCount(0);
        setCustomScanMethod(null);
        setCustomScanConfidence(0);
        setCustomDocxPreviewLines([]);
        toast.error(error instanceof Error ? error.message : "Could not scan that balance sheet");
      })
      .finally(() => {
        if (!cancelled) setCustomScanLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, customFile, templateCourseCodes]);

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-56" />
          <div className="h-36 bg-muted rounded-xl" />
          <div className="grid md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!workingModel) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto pb-8">
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-bold text-foreground">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            No system balance-sheet template is connected yet for {majorName ?? "this major"}.
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            The next supported version will let the student choose between the FiskGrad template and an uploaded custom balance sheet.
          </p>
          <div className="mt-5">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              Back to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeModel = workingModel;

  return (
    <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Advisor-facing degree sheet for {majorName ?? activeModel.majorName}, filled from your current plan and transcript-backed progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 print:hidden"
            onClick={handleDownloadPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2 print:hidden" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        <button
          type="button"
          onClick={() => setSource("system")}
          className={cn(
            "rounded-full px-4 py-2 text-sm border transition-colors",
            source === "system"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          Use FiskGrad Template
        </button>
        <button
          type="button"
          onClick={() => setSource("custom")}
          className={cn(
            "rounded-full px-4 py-2 text-sm border transition-colors",
            source === "custom"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          Use My Balance Sheet
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (file) {
              setCustomFile(file);
              setSource("custom");
              setCustomLoading(true);
              setTimeout(() => setCustomLoading(false), 1500);
            }
            event.target.value = "";
          }}
        />
      </div>

      <motion.div
        className="rounded-xl border border-primary/20 bg-primary/5 p-5 mb-6 print:hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {source === "system"
                ? activeModel.sheetTitle
                : customFile
                ? customFile.name
                : "Custom balance sheet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {source === "system"
                ? "This version uses the system major template as the source of truth. You can adjust row status, grade, term, and credits before printing."
                : customFile
                ? "Your uploaded source stays beside the editable working sheet, so you can mark rows while checking the original balance sheet."
                : "Upload a PDF or Word document version of your own balance sheet, then use the editable working sheet to mark requirements."}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="rounded-full bg-background border border-border px-3 py-1 text-xs text-foreground">
                {source === "system" ? activeModel.sourceLabel : "Custom source"}
              </span>
              <span className="rounded-full bg-background border border-border px-3 py-1 text-xs text-foreground">
                {source === "system" ? "Print layout ready" : "Editable working copy"}
              </span>
              <span className="rounded-full bg-background border border-border px-3 py-1 text-xs text-foreground">
                {source === "system" ? "Grouped requirements" : "Original source + edits"}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Print-only institutional header ── */}
      <div className="hidden print:block mb-6">
        <div className="text-center mb-4">
          <p className="text-base font-bold tracking-wide uppercase">Fisk University</p>
          <p className="text-sm font-semibold mt-0.5">{majorName ?? activeModel.majorName} — Degree Evaluation Balance Sheet</p>
        </div>
        <table className="w-full text-sm border border-black" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td className="px-3 py-1.5 border border-black w-1/4"><span className="font-semibold">Student:</span> {studentName}</td>
              <td className="px-3 py-1.5 border border-black w-1/4"><span className="font-semibold">Major:</span> {majorName ?? activeModel.majorName}</td>
              <td className="px-3 py-1.5 border border-black w-1/4"><span className="font-semibold">Entry:</span> {entryLabel ?? "—"}</td>
              <td className="px-3 py-1.5 border border-black w-1/4"><span className="font-semibold">Exp. Grad:</span> {gradLabel ?? "—"}</td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 border border-black"><span className="font-semibold">GPA:</span> {profile?.gpa != null ? Number(profile.gpa).toFixed(2) : "—"}</td>
              <td className="px-3 py-1.5 border border-black"><span className="font-semibold">Credits Earned:</span> {workingCreditsEarned} / {activeModel.totalCreditsRequired ?? degreeCreditTotal}</td>
              <td className="px-3 py-1.5 border border-black"><span className="font-semibold">Degree:</span> {activeModel.degreeType ?? "B.S."}</td>
              <td className="px-3 py-1.5 border border-black"><span className="font-semibold">Sheet date:</span> {new Date().toLocaleDateString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {source === "system" ? (
        <>
          <div className="grid md:grid-cols-4 gap-4 mb-6 print:hidden">
            {[
              {
                label: "Completed Rows",
                value: activeModel.completedRows,
                sub: "template rows matched to completed plan courses",
              },
              {
                label: "Planned Rows",
                value: activeModel.plannedRows,
                sub: "future rows already tagged from your planner",
              },
              {
                label: "Requirement Groups",
                value: activeModel.groups.length,
                sub: "sections carried over from the balance sheet",
              },
              {
                label: "Degree Target",
                value: activeModel.totalCreditsRequired ?? degreeCreditTotal,
                sub: "program total used for the final print view",
              },
            ].map((card, index) => (
              <motion.div
                key={card.label}
                className="rounded-xl border border-border bg-card p-4"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
              >
                <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{card.sub}</p>
              </motion.div>
            ))}
          </div>

          <div>
            <motion.div
              className="rounded-xl border border-border bg-card overflow-hidden"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <div className="px-5 py-4 border-b border-border print:border-b-2">
                <p className="text-sm font-semibold text-foreground">Advisor Sheet</p>
                <p className="text-xs text-muted-foreground mt-0.5 print:hidden">
                  Groups and course rows are coming from the selected major template.
                </p>
              </div>

              <div className={cn("divide-y divide-border", isBusinessLayout && "bg-amber-50/20")}>
                {activeModel.groups.map((group) => {
                  const resolvedOpen = expandedGroups[group.id] ?? (group.defaultExpanded || group.completedCount > 0 || group.plannedCount > 0);
                  return (
                    <div key={group.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: !resolvedOpen }))}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-5 py-4 transition-colors text-left",
                          isBusinessLayout ? "hover:bg-amber-50/40" : "hover:bg-muted/40"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {resolvedOpen ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 print:hidden" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 print:hidden" />
                            )}
                            <span className="text-sm font-semibold text-foreground truncate">{group.displayName}</span>
                          </div>
                          {/* Web-only pills */}
                          <div className="flex flex-wrap gap-2 mt-2 pl-0 md:pl-6 print:hidden">
                            <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px]", GROUP_TONE_STYLES[group.sectionTone])}>
                              {group.sectionTone}
                            </span>
                            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                              {GROUP_TYPE_LABEL[group.type] ?? group.type}
                            </span>
                            {group.creditsRequiredText && (
                              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                                {group.creditsRequiredText}
                              </span>
                            )}
                            <span className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px]",
                              group.isSatisfied ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"
                            )}>
                              {group.isCreditBased ? group.progressLabel : `${group.completedCount} completed`}
                            </span>
                            {group.plannedCount > 0 && (
                              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary">
                                {group.isCreditBased ? `${group.plannedCredits} cr planned` : `${group.plannedCount} planned`}
                              </span>
                            )}
                          </div>
                          {/* Print-only: credit requirement text */}
                          {group.creditsRequiredText && (
                            <p className="hidden print:block text-xs mt-0.5 pl-0" style={{ color: "#555" }}>
                              {group.creditsRequiredText}
                            </p>
                          )}
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {resolvedOpen && (
                          <motion.div
                            className="bs-group-body"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="border-t border-border overflow-x-auto">
                              <table className="w-full min-w-[760px] text-sm">
                                <thead className="bg-muted/40">
                                  <tr className="text-left text-xs text-muted-foreground">
                                    <th className="px-3 py-2.5 font-medium w-12">Mark</th>
                                    <th className="px-5 py-2.5 font-medium">Course</th>
                                    <th className="px-3 py-2.5 font-medium print:hidden">Status</th>
                                    <th className="px-3 py-2.5 font-medium">Grade</th>
                                    <th className="px-3 py-2.5 font-medium">Term</th>
                                    <th className="px-3 py-2.5 font-medium">Credits</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {group.rows.length > 0 ? (
                                    group.rows.map((row, index) => (
                                      <BalanceSheetRenderRow
                                        key={`${group.id}-${getRowKey(row, index)}`}
                                        row={row}
                                        editable
                                        onRowChange={(code, patch) => updateRowOverride(setRowOverrides, code, patch)}
                                      />
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={6} className="px-5 py-4 text-sm text-muted-foreground">
                                        This group is rule-based and does not have fixed course rows yet.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                            {(group.description || group.notes) && (
                              <div className="px-5 py-4 border-t border-border bg-muted/20 space-y-2 print:bg-transparent">
                                {group.description && (
                                  <p className="text-xs text-muted-foreground leading-relaxed">{group.description}</p>
                                )}
                                {group.notes && (
                                  <p className="text-xs text-muted-foreground leading-relaxed">{group.notes}</p>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>

          </div>

          {/* ── Print-only footer ── */}
          <div className="hidden print:block mt-8 pt-4 border-t-2 border-black">
            <table className="w-full text-sm border border-black" style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border border-black w-1/3">
                    <span className="font-semibold">Total Credits Earned:</span> {workingCreditsEarned}
                  </td>
                  <td className="px-3 py-2 border border-black w-1/3">
                    <span className="font-semibold">Credits Required:</span> {activeModel.totalCreditsRequired ?? degreeCreditTotal}
                  </td>
                  <td className="px-3 py-2 border border-black w-1/3">
                    <span className="font-semibold">Remaining:</span> {Math.max(0, (activeModel.totalCreditsRequired ?? degreeCreditTotal) - workingCreditsEarned)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-5 border border-black" colSpan={2}>
                    <span className="font-semibold">Advisor Signature:</span>{" "}
                    <span style={{ borderBottom: "1px solid black", display: "inline-block", width: "260px" }}>&nbsp;</span>
                  </td>
                  <td className="px-3 py-5 border border-black">
                    <span className="font-semibold">Date:</span>{" "}
                    <span style={{ borderBottom: "1px solid black", display: "inline-block", width: "100px" }}>&nbsp;</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-[10px] text-center mt-3" style={{ color: "#888" }}>
              Generated by FiskGrad · {new Date().toLocaleDateString()}
            </p>
          </div>
        </>
      ) : (
        <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-4 print:block">
          <motion.div
            className="rounded-xl border border-border bg-card overflow-hidden"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Custom Balance Sheet</p>
              <p className="text-xs text-muted-foreground mt-0.5 print:hidden">
                Uploaded source for the current session.
              </p>
            </div>

            {customFile && customFileUrl ? (
              <div className="h-[70vh] print:h-auto bg-muted/20">
                {customFile.type === "application/pdf" ? (
                  <iframe title="Custom balance sheet preview" src={customFileUrl} className="w-full h-full min-h-[70vh]" />
                ) : customFile.type.startsWith("image/") ? (
                  <div className="p-4 flex items-center justify-center h-full">
                    <img src={customFileUrl} alt="Custom balance sheet" className="max-w-full max-h-[66vh] object-contain border border-border bg-background" />
                  </div>
                ) : isDocxFile(customFile) ? (
                  <div className="h-full overflow-auto bg-background">
                    {customScanLoading && customDocxPreviewLines.length === 0 ? (
                      <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading Word preview...
                      </div>
                    ) : customDocxPreviewLines.length > 0 ? (
                      <div className="p-6 space-y-2 text-sm leading-relaxed text-foreground">
                        {customDocxPreviewLines.map((line, index) => (
                          <p key={`${index}-${line.slice(0, 24)}`} className="whitespace-pre-wrap">
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-sm text-muted-foreground">
                        No readable Word preview was found. Use the download action to open this file.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-sm text-muted-foreground">
                    Preview is not available for this file type. Use the download action to open this file.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FileUp className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No custom balance sheet uploaded yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Upload a PDF or Word document to use your own advisor balance sheet as the source.
                </p>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2 print:hidden">
                  <Upload className="w-4 h-4" />
                  Upload File
                </Button>
              </div>
            )}
          </motion.div>
          <motion.div
            className="rounded-xl border border-border bg-card overflow-hidden print:block"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
          >
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Editable Working Sheet</p>
              <p className="text-xs text-muted-foreground mt-0.5 print:hidden">
                Mark this table while checking the uploaded source. Downloads and print use these edits.
              </p>
            </div>
            <div className="max-h-[70vh] overflow-auto print:max-h-none">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 sticky top-0 z-10">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium w-12">Mark</th>
                    <th className="px-5 py-2.5 font-medium">Course</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Grade</th>
                    <th className="px-3 py-2.5 font-medium">Term</th>
                    <th className="px-3 py-2.5 font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeModel.groups.flatMap((group) =>
                    group.rows.map((row, index) => (
                      <BalanceSheetRenderRow
                        key={`${group.id}-${getRowKey(row, index)}`}
                        row={row}
                        editable
                        onRowChange={(code, patch) => updateRowOverride(setRowOverrides, code, patch)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-border flex flex-wrap gap-2 print:hidden">
              {customLoading ? (
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing your balance sheet...
                </span>
              ) : customFile ? (
                <>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={handleDownloadFilledCustomPdf}
                    disabled={exportingCustomPdf || customScanLoading || customMatches.length === 0}
                  >
                    {exportingCustomPdf || customScanLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download Filled Balance Sheet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    Replace File
                  </Button>
                  <span className="basis-full text-[11px] text-muted-foreground">
                    {customScanLoading
                      ? "Scanning for course codes in your balance sheet..."
                      : customScanMethod
                        ? customMatches.length === 0
                          ? "No course codes from your plan were found in this file. Check that the file contains readable text."
                          : `${customMatches.length} course${customMatches.length === 1 ? "" : "s"} matched from your plan${customScanMethod === "ocr" ? ` via OCR (${Math.round(customScanConfidence * 100)}% confidence)` : customScanMethod === "docx" ? " in Word document" : " in PDF"}${customUnmatchedCount > 0 ? ` · ${customUnmatchedCount} not found in file` : ""} — click Download to get the filled version.`
                        : "Upload a PDF or Word (.docx) balance sheet to auto-fill from your plan."}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Upload a source file when you need to compare against the original sheet.</span>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.5in;
          }

          body {
            background: white !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function safeFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "student";
}

function normalizeRowKey(code: string): string {
  return code.replace(/[-\s]+/g, " ").trim().toUpperCase();
}

function updateRowOverride(
  setRowOverrides: Dispatch<SetStateAction<RowOverrideMap>>,
  code: string,
  patch: RowOverride
) {
  const key = normalizeRowKey(code);
  setRowOverrides((prev) => ({
    ...prev,
    [key]: {
      ...prev[key],
      ...patch,
    },
  }));
}

function applyBalanceSheetOverrides(
  model: BalanceSheetViewModel | null,
  overrides: RowOverrideMap
): BalanceSheetViewModel | null {
  if (!model) return null;

  const groups = model.groups.map((group) => {
    const rows = group.rows.map((row) => applyRenderableOverride(row, overrides));
    const courseRows = collectCourseRows(rows);
    const completedCount = courseRows.filter((row) => row.status === "completed").length;
    const plannedCount = courseRows.filter((row) => row.status === "planned").length;
    const completedCredits = courseRows.reduce(
      (sum, row) => sum + (row.status === "completed" ? row.actualCredits ?? row.templateCredits ?? 0 : 0),
      0
    );
    const plannedCredits = courseRows.reduce(
      (sum, row) => sum + (row.status === "planned" ? row.actualCredits ?? row.templateCredits ?? 0 : 0),
      0
    );
    const isSatisfied = group.isCreditBased && group.requiredCredits != null
      ? completedCredits >= group.requiredCredits
      : courseRows.length > 0 && courseRows.every((row) => row.status === "completed");
    const progressLabel = group.isCreditBased && group.requiredCredits != null
      ? `${Math.min(completedCredits, group.requiredCredits)}/${group.requiredCredits} cr`
      : `${completedCount}/${courseRows.length} rows`;

    return {
      ...group,
      rows,
      completedCount,
      plannedCount,
      completedCredits,
      plannedCredits,
      isSatisfied,
      progressLabel,
    } satisfies BalanceSheetGroupView;
  });

  return {
    ...model,
    groups,
    completedRows: groups.reduce((sum, group) => sum + group.completedCount, 0),
    plannedRows: groups.reduce((sum, group) => sum + group.plannedCount, 0),
  };
}

function applyRenderableOverride(row: BalanceSheetRenderableRow, overrides: RowOverrideMap): BalanceSheetRenderableRow {
  if (row.kind === "course") return applyCourseOverride(row, overrides);
  if (row.kind === "course_pair") {
    return {
      ...row,
      courses: row.courses.map((course) => applyCourseOverride(course, overrides)),
    };
  }
  return row;
}

function applyCourseOverride(row: BalanceSheetRow, overrides: RowOverrideMap): BalanceSheetRow {
  const override = overrides[normalizeRowKey(row.code)];
  if (!override) return row;
  return {
    ...row,
    status: override.status ?? row.status,
    grade: override.grade !== undefined ? override.grade : row.grade,
    termCode: override.termCode !== undefined ? override.termCode : row.termCode,
    actualCredits: override.actualCredits !== undefined ? override.actualCredits : row.actualCredits,
  };
}

function collectCourseRows(rows: BalanceSheetRenderableRow[]): BalanceSheetRow[] {
  return rows.flatMap((row) => {
    if (row.kind === "course") return [row];
    if (row.kind === "course_pair") return row.courses;
    return [];
  });
}

function getUniqueCompletedCredits(groups: BalanceSheetGroupView[]): number | null {
  if (groups.length === 0) return null;
  const byCode = new Map<string, BalanceSheetRow>();
  groups.forEach((group) => {
    collectCourseRows(group.rows).forEach((row) => {
      if (row.status === "completed") byCode.set(normalizeRowKey(row.code), row);
    });
  });
  return Array.from(byCode.values()).reduce(
    (sum, row) => sum + (row.actualCredits ?? row.templateCredits ?? 0),
    0
  );
}

function getFillRows(groups: BalanceSheetGroupView[]): BalanceSheetFillRow[] {
  return groups.flatMap((group) =>
    collectCourseRows(group.rows).map((row) => ({
      code: row.code,
      status: row.status,
      grade: row.grade,
      term: row.termCode,
      credits: row.actualCredits ?? row.templateCredits ?? null,
    }))
  );
}

function getTemplateCourseCodes(groups: BalanceSheetGroupView[]): string[] {
  const codes = new Set<string>();
  groups.forEach((group) => {
    collectCourseRows(group.rows).forEach((row) => codes.add(row.code));
  });
  return Array.from(codes);
}

function BalanceSheetTableRow({
  row,
  editable = false,
  onRowChange,
}: {
  row: BalanceSheetRow;
  editable?: boolean;
  onRowChange?: (code: string, patch: RowOverride) => void;
}) {
  const statusMeta = STATUS_META[row.status];
  const creditText = row.actualCredits ?? row.templateCredits ?? "-";

  return (
    <tr
      className={cn(
        "align-top",
        row.status === "completed" && "bg-green-50/40",
        row.status === "planned" && "bg-primary/[0.03]"
      )}
    >
      <td className="px-3 py-3">
        <div
          className={cn(
            "w-5 h-5 rounded border flex items-center justify-center text-[11px] font-semibold",
            row.status === "completed"
              ? "border-green-600 text-green-700 bg-green-50"
              : row.status === "planned"
              ? "border-primary text-primary bg-primary/5"
              : "border-border text-muted-foreground"
          )}
        >
          {row.status === "completed" ? "X" : row.status === "planned" ? "•" : ""}
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-start gap-3">
          <span className="print:hidden">{statusMeta.icon}</span>
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-foreground">{row.code}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{row.name}</p>
            {row.annotations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 print:hidden">
                {row.annotations.map((note) => (
                  <span
                    key={note}
                    className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {note}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 print:hidden">
        {editable ? (
          <select
            value={row.status}
            onChange={(event) => onRowChange?.(row.code, { status: event.target.value as BalanceSheetRow["status"] })}
            className="w-28 rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground"
          >
            <option value="empty">Open</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
          </select>
        ) : (
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium", statusMeta.pill)}>
            {statusMeta.text}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-foreground font-medium">
        {editable ? (
          <input
            value={row.grade ?? ""}
            onChange={(event) => onRowChange?.(row.code, { grade: event.target.value.trim() || null })}
            placeholder="-"
            className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        ) : row.grade ?? "-"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground font-mono">
        {editable ? (
          <input
            value={row.termCode ?? ""}
            onChange={(event) => onRowChange?.(row.code, { termCode: event.target.value.trim().toUpperCase() || null })}
            placeholder="FA26"
            className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
          />
        ) : row.termCode ?? "-"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground font-mono">
        {editable ? (
          <input
            value={row.actualCredits ?? row.templateCredits ?? ""}
            onChange={(event) => {
              const value = Number(event.target.value);
              onRowChange?.(row.code, { actualCredits: Number.isFinite(value) ? value : null });
            }}
            type="number"
            min="0"
            step="0.5"
            className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
          />
        ) : creditText}
      </td>
    </tr>
  );
}

function BalanceSheetRenderRow({
  row,
  editable = false,
  onRowChange,
}: {
  row: BalanceSheetRenderableRow;
  editable?: boolean;
  onRowChange?: (code: string, patch: RowOverride) => void;
}) {
  if (row.kind === "course") return <BalanceSheetTableRow row={row} editable={editable} onRowChange={onRowChange} />;
  if (row.kind === "course_pair") return <BalanceSheetPairRow row={row} editable={editable} onRowChange={onRowChange} />;

  if (row.kind === "choice_summary") {
    return (
      <tr className="bg-primary/[0.04]">
        <td colSpan={6} className="px-5 py-3 text-sm text-primary font-medium">
          {row.text}
        </td>
      </tr>
    );
  }

  if (row.kind === "bucket") {
    return (
      <tr className="bg-muted/20">
        <td colSpan={6} className="px-5 py-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{row.label}</p>
            {row.creditsRequiredText && (
              <p className="text-xs text-muted-foreground">{row.creditsRequiredText}</p>
            )}
            {row.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{row.description}</p>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-muted/20">
      <td colSpan={6} className="px-5 py-4 text-sm text-muted-foreground leading-relaxed">
        {row.text}
      </td>
    </tr>
  );
}

function getRowKey(row: BalanceSheetRenderableRow, index: number): string {
  if (row.kind === "course") return row.code;
  if (row.kind === "course_pair") return `${row.relationship}-${row.label}-${index}`;
  if (row.kind === "choice_summary") return `choice-${index}`;
  if (row.kind === "bucket") return `${row.label}-${index}`;
  return `note-${index}`;
}

function BalanceSheetPairRow({
  row,
  editable = false,
  onRowChange,
}: {
  row: BalanceSheetCoursePairRow;
  editable?: boolean;
  onRowChange?: (code: string, patch: RowOverride) => void;
}) {
  return (
    <tr className="bg-muted/10">
      <td colSpan={6} className="px-5 py-4">
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-muted/40 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">{row.label}</p>
            <span className="text-[11px] text-muted-foreground capitalize">
              {row.relationship === "corequisite"
                ? "Co-requisite pair"
                : row.relationship === "satisfaction"
                ? "Requirement options"
                : "Alternative options"}
            </span>
          </div>
          <div className="divide-y divide-border">
            {row.courses.map((course) => (
              <div key={course.code} className="px-4 py-3">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] gap-3 items-start">
                  <div
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center text-[11px] font-semibold mt-0.5",
                      course.status === "completed"
                        ? "border-green-600 text-green-700 bg-green-50"
                        : course.status === "planned"
                        ? "border-primary text-primary bg-primary/5"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {course.status === "completed" ? "X" : course.status === "planned" ? "•" : ""}
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-foreground">{course.code}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{course.name}</p>
                    {course.annotations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {course.annotations.map((note) => (
                          <span
                            key={note}
                            className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {note}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {editable ? (
                    <select
                      value={course.status}
                      onChange={(event) => onRowChange?.(course.code, { status: event.target.value as BalanceSheetRow["status"] })}
                      className="w-28 rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground"
                    >
                      <option value="empty">Open</option>
                      <option value="planned">Planned</option>
                      <option value="completed">Completed</option>
                    </select>
                  ) : (
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium h-fit", STATUS_META[course.status].pill)}>
                      {STATUS_META[course.status].text}
                    </span>
                  )}
                  {editable ? (
                    <input
                      value={course.termCode ?? ""}
                      onChange={(event) => onRowChange?.(course.code, { termCode: event.target.value.trim().toUpperCase() || null })}
                      placeholder="FA26"
                      className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
                    />
                  ) : (
                    <span className="text-sm text-foreground font-mono">{course.termCode ?? "-"}</span>
                  )}
                  {editable ? (
                    <input
                      value={course.actualCredits ?? course.templateCredits ?? ""}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        onRowChange?.(course.code, { actualCredits: Number.isFinite(value) ? value : null });
                      }}
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
                    />
                  ) : (
                    <span className="text-sm text-foreground font-mono">{course.actualCredits ?? course.templateCredits ?? "-"}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}
