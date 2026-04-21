"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/contexts/plan-context";

const GRADE_POINTS: Record<string, number> = {
  "A+": 4.0, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D+": 1.3, "D": 1.0, "D-": 0.7,
  "F": 0.0,
};
const GRADE_OPTIONS = Object.keys(GRADE_POINTS);

interface Row {
  id: number;
  name: string;
  credits: string;
  grade: string;
}

let _id = 0;
const newRow = (name = "", credits = "3", grade = "A"): Row => ({ id: ++_id, name, credits, grade });

function GpaGauge({ gpa }: { gpa: number }) {
  const pct = (gpa / 4.0) * 100;
  const color =
    gpa >= 3.5 ? "text-green-600" : gpa >= 3.0 ? "text-primary" : gpa >= 2.0 ? "text-amber-600" : "text-destructive";
  const barColor =
    gpa >= 3.5 ? "bg-green-500" : gpa >= 3.0 ? "bg-primary" : gpa >= 2.0 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex flex-col items-center gap-2">
      <p className={cn("text-5xl font-bold tabular-nums", color)}>{gpa.toFixed(2)}</p>
      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">out of 4.00</p>
    </div>
  );
}

export default function GpaPage() {
  const { profile } = usePlan();

  const [currentGpa, setCurrentGpa] = useState(
    profile?.gpa != null ? String(Number(profile.gpa).toFixed(2)) : ""
  );
  const [currentCredits, setCurrentCredits] = useState("0");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (id: number) => setRows((prev) => prev.filter((r) => r.id !== id));
  const updateRow = (id: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const { projectedGpa, addedCredits, addedPoints } = useMemo(() => {
    const existingGpa = parseFloat(currentGpa);
    const existingCr = parseFloat(currentCredits);
    let addedCr = 0;
    let addedPts = 0;
    for (const row of rows) {
      const cr = parseFloat(row.credits);
      const pts = GRADE_POINTS[row.grade];
      if (!isNaN(cr) && cr > 0 && pts !== undefined) {
        addedCr += cr;
        addedPts += cr * pts;
      }
    }
    const totalCr = (isNaN(existingCr) ? 0 : existingCr) + addedCr;
    const totalPts = (isNaN(existingGpa) || isNaN(existingCr) ? 0 : existingGpa * existingCr) + addedPts;
    const projected = totalCr > 0 ? Math.min(totalPts / totalCr, 4.0) : NaN;
    return { projectedGpa: projected, addedCredits: addedCr, addedPoints: addedPts };
  }, [currentGpa, currentCredits, rows]);

  const hasBase = !isNaN(parseFloat(currentGpa)) && !isNaN(parseFloat(currentCredits));
  const hasRows = rows.some((r) => !isNaN(parseFloat(r.credits)) && parseFloat(r.credits) > 0);

  return (
    <div className="px-4 md:px-8 py-6 pb-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">GPA Calculator</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        See how your planned courses will affect your cumulative GPA.
      </p>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Current standing */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Your Current Standing</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Cumulative GPA</label>
              <input
                type="number" min="0" max="4" step="0.01"
                value={currentGpa}
                onChange={(e) => setCurrentGpa(e.target.value)}
                placeholder="e.g. 3.25"
                className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Credits Completed</label>
              <input
                type="number" min="0" step="1"
                value={currentCredits}
                onChange={(e) => setCurrentCredits(e.target.value)}
                placeholder="e.g. 60"
                className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>
          {hasBase && (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-2">Current GPA</p>
              <GpaGauge gpa={parseFloat(currentGpa)} />
            </div>
          )}
        </div>

        {/* Projected result */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
          <h2 className="text-sm font-semibold text-foreground mb-3">Projected GPA</h2>
          {!isNaN(projectedGpa) && hasRows ? (
            <>
              <GpaGauge gpa={projectedGpa} />
              <div className="mt-4 pt-4 border-t border-border space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">New credits added</span>
                  <span className="font-medium text-foreground">{addedCredits}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Quality points added</span>
                  <span className="font-medium text-foreground">{addedPoints.toFixed(1)}</span>
                </div>
                {hasBase && (
                  <div className="flex justify-between text-xs pt-1 border-t border-border">
                    <span className="text-muted-foreground">GPA change</span>
                    <span className={cn("font-semibold", projectedGpa >= parseFloat(currentGpa) ? "text-green-600" : "text-destructive")}>
                      {projectedGpa >= parseFloat(currentGpa) ? "+" : ""}
                      {(projectedGpa - parseFloat(currentGpa)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <TrendingUp className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {!hasBase ? "Enter your current GPA and credits above" : "Add at least one course with credits below"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Course rows */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Courses to Add</h2>
          <button onClick={addRow}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add course
          </button>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_90px_36px] gap-2 px-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Course</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Credits</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Grade</span>
          <span />
        </div>

        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_80px_90px_36px] gap-2 items-center">
            <input
              type="text" value={row.name} onChange={(e) => updateRow(row.id, "name", e.target.value)}
              placeholder="e.g. CSCI 310"
              className="text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <input
              type="number" min="1" max="6" step="1" value={row.credits}
              onChange={(e) => updateRow(row.id, "credits", e.target.value)}
              className="text-sm rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40 text-center"
            />
            <select value={row.grade} onChange={(e) => updateRow(row.id, "grade", e.target.value)}
              className="text-sm rounded-lg border border-input bg-background px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40">
              {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g} ({GRADE_POINTS[g].toFixed(1)})</option>)}
            </select>
            <button onClick={() => removeRow(row.id)} disabled={rows.length === 1}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
