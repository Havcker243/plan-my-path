"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, GraduationCap, BookOpen, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans overflow-x-hidden">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <GraduationCap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground tracking-tight">FiskGrad</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          <Link href="/explore" className="hover:text-foreground transition-colors">Browse courses</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="hidden md:inline-flex">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="gap-1.5">
              Get started <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative px-6 md:px-12 pt-20 pb-24 max-w-6xl mx-auto">
        {/* Background blobs */}
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -12, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-8 right-[8%] h-56 w-56 rounded-full bg-amber-400/8 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ x: [0, -16, 0], y: [0, 14, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[2%] top-24 h-44 w-44 rounded-full bg-primary/8 blur-3xl pointer-events-none"
        />

        <div className="flex flex-col lg:flex-row items-center gap-14">

          {/* Left: copy */}
          <div className="flex-1 text-center lg:text-left">

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0 }}
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold mb-6">
                <GraduationCap className="w-3.5 h-3.5" />
                Made for Fisk University students
              </span>
            </motion.div>

            <motion.h1
              {...fadeUp}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.08 }}
              className="text-4xl md:text-5xl lg:text-[52px] font-bold text-foreground leading-[1.12] tracking-tight text-balance mb-5"
            >
              Your path from freshman year to graduation day.
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 }}
              className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0"
            >
              Map your 4-year plan, track every requirement, and always know exactly when you&apos;ll walk — all in one place built for Fisk students.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.22 }}
              className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start mb-6"
            >
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-11 px-6">
                  Build my plan
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/explore">
                <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 text-base h-11 px-6">
                  <BookOpen className="w-4 h-4" />
                  Browse courses
                </Button>
              </Link>
            </motion.div>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.28 }}
              className="text-xs text-muted-foreground"
            >
              Free to use · No credit card required · Fisk email only
            </motion.p>
          </div>

          {/* Right: product preview */}
          <motion.div
            className="flex-1 w-full max-w-lg"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.18 }}
          >
            <GraduationJourneyPreview />
          </motion.div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="border-y border-border bg-muted/30 py-20 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">How it works</p>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-balance">
              From signup to graduation plan in minutes.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            {[
              {
                num: "01",
                title: "Pick your major",
                desc: "Select your program and FiskGrad automatically loads all your degree requirements — required courses, group choices, electives, and gen eds.",
                color: "text-primary",
                bg: "bg-primary/8",
              },
              {
                num: "02",
                title: "Build your plan",
                desc: "Add courses to each semester. We warn you about prereqs, overloaded terms, and missing requirements in real time so nothing slips through.",
                color: "text-amber-600",
                bg: "bg-amber-50",
              },
              {
                num: "03",
                title: "Know when you'll graduate",
                desc: "See your graduation date, credits completed, and what's left to do — updated every time you change your plan. No more guessing.",
                color: "text-green-600",
                bg: "bg-green-50",
              },
            ].map(({ num, title, desc, color, bg }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.1 }}
                className="flex flex-col gap-4"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bg)}>
                  <span className={cn("text-sm font-bold font-mono", color)}>{num}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Student voices ── */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">From students</p>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">What Fisk students are saying.</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                quote: "I finally understand what I need to take next semester. Brought this printout to my advisor and she loved it.",
                name: "Maya R.",
                role: "Biology · Junior",
              },
              {
                quote: "The prereq warnings saved me from signing up for a class I wasn't ready for. It caught something my advisor missed.",
                name: "Tomas C.",
                role: "Computer Science · Sophomore",
              },
              {
                quote: "I switched my major and FiskGrad rebuilt my whole plan in seconds. Would have been hours on a spreadsheet.",
                name: "Priya S.",
                role: "Econ → Data Science",
              },
            ].map(({ quote, name, role }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.1 }}
                className="flex flex-col gap-4 p-5 rounded-2xl border border-border bg-card"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">&ldquo;{quote}&rdquo;</p>
                <div className="pt-1 border-t border-border">
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">{role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto rounded-3xl bg-gradient-to-br from-primary to-primary/80 px-8 py-12 text-center shadow-xl shadow-primary/20"
        >
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-5">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 text-balance">
            Ready to map your graduation?
          </h2>
          <p className="text-primary-foreground/75 mb-8 text-sm leading-relaxed">
            Takes less than 5 minutes to build your first plan.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="gap-2 font-semibold h-11 px-7">
              Build my plan free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-6 px-6 md:px-12 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>FiskGrad &copy; 2026</span>
        </div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

function GraduationJourneyPreview() {
  const semesters = [
    { label: "Fall 2023", credits: 15, status: "done" as const },
    { label: "Spring 2024", credits: 16, status: "done" as const },
    { label: "Fall 2024", courses: ["CSCI 311", "MATH 341", "CSCI 420"], credits: 9, status: "current" as const },
    { label: "Spring 2025", credits: 15, status: "planned" as const },
  ];

  return (
    <div className="rounded-2xl border border-border shadow-2xl shadow-slate-200/60 bg-card overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/30">
        <span className="w-3 h-3 rounded-full bg-red-400/80" />
        <span className="w-3 h-3 rounded-full bg-amber-400/80" />
        <span className="w-3 h-3 rounded-full bg-green-400/80" />
        <span className="ml-3 text-xs text-muted-foreground">FiskGrad · Dashboard</span>
        <span className="ml-auto text-[11px] text-green-600 font-semibold flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3" /> On track
        </span>
      </div>

      <div className="p-5">
        {/* Student identity */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Welcome back</p>
            <p className="text-base font-bold text-foreground">Jordan M.</p>
            <p className="text-xs text-muted-foreground mt-0.5">Computer Science · Sophomore</p>
          </div>
          <span className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
            Class of &apos;26
          </span>
        </div>

        {/* Graduation target */}
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200/80 px-3.5 py-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-800">Graduating Spring 2026</p>
            <p className="text-[11px] text-amber-600 mt-0.5">All requirements on track</p>
          </div>
        </div>

        {/* Credits progress */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground font-medium">Credits completed</span>
            <span className="font-bold text-foreground">47 <span className="text-muted-foreground font-normal">/ 120</span></span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
              initial={{ width: "0%" }}
              animate={{ width: "39%" }}
              transition={{ duration: 1.4, delay: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] mt-1.5">
            <span className="text-green-600 font-semibold">On track · 39%</span>
            <span className="text-muted-foreground">73 credits left</span>
          </div>
        </div>

        {/* Semester grid */}
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Semester Plan</p>
          <div className="grid grid-cols-2 gap-2">
            {semesters.map((sem, i) => (
              <motion.div
                key={sem.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.6 + i * 0.07 }}
                className={cn(
                  "rounded-xl border p-3 text-[11px]",
                  sem.status === "done"
                    ? "bg-green-50/80 border-green-200/80"
                    : sem.status === "current"
                    ? "bg-primary/5 border-primary/30"
                    : "bg-background border-border"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "font-bold text-xs",
                    sem.status === "current" ? "text-primary" : "text-foreground"
                  )}>
                    {sem.label}
                  </span>
                  {sem.status === "done" && <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                  {sem.status === "current" && (
                    <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full tracking-wide">
                      NOW
                    </span>
                  )}
                </div>
                {sem.status === "current" && sem.courses ? (
                  <div className="flex flex-col gap-1">
                    {sem.courses.map((c) => (
                      <div key={c} className="text-[10px] text-muted-foreground bg-background border border-border rounded-md px-2 py-0.5 truncate">
                        {c}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={cn(
                    "text-[11px]",
                    sem.status === "done" ? "text-green-700 font-medium" : "text-muted-foreground"
                  )}>
                    {sem.credits} credits
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
