"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usePlan } from "@/contexts/plan-context";
import { getCompletedCredits, getTotalCredits, type RequirementLabel } from "@/lib/data";
import { formatDisplayName } from "@/lib/utils";

const LABEL_BADGE: Record<RequirementLabel, string> = {
  required: "REQ",
  group: "GRP",
  elective: "ELC",
  general: "GEN",
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatStatus(status: string | undefined) {
  if (status === "completed") return "Done";
  if (status === "failed") return "Failed";
  return "Planned";
}

export default function PlanExportPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, semesters, planCatalog, majors, degreeCreditTotal, initialized } = usePlan();

  if (authLoading) return null;
  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  const studentName = profile?.name?.trim() || user?.email || "Student";
  const majorName = formatDisplayName(
    majors.find((major) => major.code === profile?.major_code)?.name ?? profile?.major_code ?? null
  );
  const minorName = profile?.minor_code
    ? formatDisplayName(majors.find((major) => major.code === profile.minor_code)?.name ?? profile.minor_code)
    : null;
  const entryLabel = profile?.start_term && profile?.start_year
    ? `${capitalize(profile.start_term)} ${profile.start_year}`
    : null;
  const gradLabel = profile?.graduation_term && profile?.graduation_year
    ? `${capitalize(profile.graduation_term)} ${profile.graduation_year}`
    : null;

  const completedCredits = getCompletedCredits(semesters, planCatalog);
  const plannedCredits = semesters.flatMap((semester) => semester.courseIds).reduce((acc, courseId) => {
    const course = planCatalog[courseId];
    return course?.status === "planned" ? acc + (course.credits ?? 0) : acc;
  }, 0);
  const totalCredits = degreeCreditTotal;
  const gpa = profile?.gpa != null ? Number(profile.gpa).toFixed(2) : null;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const nonEmptySemesters = semesters.filter((semester) => semester.courseIds.length > 0);

  useEffect(() => {
    if (!initialized || typeof window === "undefined") return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [initialized]);

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.6in 0.7in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: Georgia, serif; color: #111; background: white; }
        * { box-sizing: border-box; }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800"
        >
          Print / Save PDF
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="px-4 py-2 bg-white border border-gray-300 text-sm rounded-md hover:bg-gray-50"
        >
          Close
        </button>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 40px 60px" }}>
        <div style={{ borderBottom: "2px solid #111", paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
            <div>
              <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#555", margin: "0 0 4px" }}>
                Fisk University - FiskGrad Academic Plan
              </p>
              <h1 style={{ fontSize: 22, fontWeight: "bold", margin: 0 }}>{studentName}</h1>
              {majorName && (
                <p style={{ fontSize: 13, color: "#444", margin: "4px 0 0" }}>
                  {majorName}{minorName ? ` / Minor: ${minorName}` : ""}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "#555", flexShrink: 0 }}>
              <p style={{ margin: 0 }}>{today}</p>
              {entryLabel && gradLabel && (
                <p style={{ margin: "4px 0 0" }}>{entryLabel} to {gradLabel}</p>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Completed Credits", value: completedCredits },
            { label: "Planned Credits", value: plannedCredits },
            { label: "Total Required", value: totalCredits },
            { label: "Cumulative GPA", value: gpa ?? "N/A" },
          ].map((stat) => (
            <div key={stat.label} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "10px 12px" }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#777", margin: 0 }}>{stat.label}</p>
              <p style={{ fontSize: 20, fontWeight: "bold", margin: "4px 0 0" }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {nonEmptySemesters.length === 0 ? (
          <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 16, fontSize: 13, color: "#555" }}>
            No courses have been added to this plan yet.
          </div>
        ) : (
          nonEmptySemesters.map((semester) => {
            const semesterCredits = getTotalCredits(semester.courseIds, planCatalog);

            return (
              <div key={semester.id} style={{ marginBottom: 20, pageBreakInside: "avoid" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: semester.isPast ? "#f0f0f0" : semester.isCurrent ? "#e8f0fe" : "#f9f9f9",
                    border: "1px solid #ccc",
                    borderRadius: "6px 6px 0 0",
                    padding: "7px 12px",
                  }}
                >
                  <span style={{ fontWeight: "bold", fontSize: 13 }}>
                    {semester.term} {semester.year}
                    {semester.isCurrent && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: "#1a56db", fontWeight: "normal" }}>Current</span>
                    )}
                    {semester.isPast && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: "#555", fontWeight: "normal" }}>Completed</span>
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: "#555" }}>{semesterCredits} credits</span>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc", borderTop: "none" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#fafafa" }}>
                      <th style={{ textAlign: "left", padding: "5px 10px", fontSize: 10, color: "#777", fontWeight: "normal", width: "15%", borderBottom: "1px solid #ddd" }}>Code</th>
                      <th style={{ textAlign: "left", padding: "5px 10px", fontSize: 10, color: "#777", fontWeight: "normal", borderBottom: "1px solid #ddd" }}>Course Title</th>
                      <th style={{ textAlign: "center", padding: "5px 10px", fontSize: 10, color: "#777", fontWeight: "normal", width: "8%", borderBottom: "1px solid #ddd" }}>Cr</th>
                      <th style={{ textAlign: "center", padding: "5px 10px", fontSize: 10, color: "#777", fontWeight: "normal", width: "10%", borderBottom: "1px solid #ddd" }}>Grade</th>
                      <th style={{ textAlign: "center", padding: "5px 10px", fontSize: 10, color: "#777", fontWeight: "normal", width: "10%", borderBottom: "1px solid #ddd" }}>Type</th>
                      <th style={{ textAlign: "center", padding: "5px 10px", fontSize: 10, color: "#777", fontWeight: "normal", width: "12%", borderBottom: "1px solid #ddd" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semester.courseIds.map((courseId, index) => {
                      const course = planCatalog[courseId];
                      return (
                        <tr key={`${semester.id}-${courseId}`} style={{ backgroundColor: index % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "6px 10px", fontSize: 12, fontFamily: "monospace", fontWeight: 600, borderBottom: "1px solid #eee" }}>{courseId}</td>
                          <td style={{ padding: "6px 10px", fontSize: 12, borderBottom: "1px solid #eee" }}>{course?.title ?? "N/A"}</td>
                          <td style={{ padding: "6px 10px", fontSize: 12, textAlign: "center", borderBottom: "1px solid #eee" }}>{course?.credits ?? "N/A"}</td>
                          <td style={{ padding: "6px 10px", fontSize: 12, textAlign: "center", borderBottom: "1px solid #eee" }}>{course?.grade ?? "N/A"}</td>
                          <td style={{ padding: "6px 10px", fontSize: 11, textAlign: "center", borderBottom: "1px solid #eee", color: "#555" }}>
                            {course ? LABEL_BADGE[course.label] : "N/A"}
                          </td>
                          <td style={{ padding: "6px 10px", fontSize: 11, textAlign: "center", borderBottom: "1px solid #eee" }}>
                            {formatStatus(course?.status)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })
        )}

        <div style={{ borderTop: "1px solid #ccc", paddingTop: 14, marginTop: 28, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888" }}>
          <span>Generated by FiskGrad / fiskgrad.app</span>
          <span>Printed {today}</span>
        </div>
      </div>
    </>
  );
}
