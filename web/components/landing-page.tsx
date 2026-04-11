"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, GraduationCap, Map, BookOpen, CalendarDays, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: "easeOut" },
};

const featureHighlights = [
  "Transcript import",
  "Planner autosave",
  "Section calendar",
  "Requirement tracking",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans overflow-x-hidden">
      <header className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <GraduationCap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">Fiskpath</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <Link href="/explore" className="hover:text-foreground transition-colors">Explore Courses</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="hidden md:inline-flex">Sign in</Button>
          </Link>
          <Link href="/onboarding">
            <Button size="sm">Start Planning Free</Button>
          </Link>
        </div>
      </header>

      <section className="relative px-6 md:px-12 pt-20 pb-16 max-w-6xl mx-auto">
        <motion.div
          animate={{ x: [0, 18, 0], y: [0, -10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 right-[10%] h-40 w-40 rounded-full bg-primary/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -14, 0], y: [0, 12, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[4%] top-32 h-32 w-32 rounded-full bg-orange-400/10 blur-3xl"
        />

        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6"
            >
              <Star className="w-3 h-3" />
              Built for Fisk University students
            </motion.div>
            <motion.h1
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold text-foreground leading-tight text-balance mb-5"
            >
              Not sure if you&apos;re on track to graduate?
            </motion.h1>
            <motion.p
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
              className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0"
            >
              Build your 4-year plan in minutes. See exactly which courses you need, when to take them, and know before your advisor meeting.
            </motion.p>
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start"
            >
              <Link href="/onboarding">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  Start Planning Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/explore">
                <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
                  <BookOpen className="w-4 h-4" />
                  Browse Courses
                </Button>
              </Link>
            </motion.div>
            <motion.p
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.4 }}
              className="text-xs text-muted-foreground mt-4"
            >
              No credit card. No signup required to preview.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.5 }}
              className="flex flex-wrap gap-2 mt-7 justify-center lg:justify-start"
            >
              {featureHighlights.map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + index * 0.06 }}
                  whileHover={{ y: -2 }}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground shadow-sm"
                >
                  {item}
                </motion.div>
              ))}
            </motion.div>
          </div>

          <motion.div
            className="flex-1 w-full max-w-xl"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          >
            <PlannerPreview />
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="bg-muted/40 border-y border-border py-16 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-12 text-balance">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Pick your major",
                desc: "Select your program and we load all your degree requirements automatically.",
                icon: GraduationCap,
              },
              {
                step: "02",
                title: "Build your plan",
                desc: "Drag courses into semesters. We warn you about prereqs and overloaded terms in real-time.",
                icon: Map,
              },
              {
                step: "03",
                title: "Track your progress",
                desc: "See exactly how many credits you've completed and when you'll graduate, always up to date.",
                icon: CheckCircle,
              },
            ].map(({ step, title, desc, icon: Icon }, index) => (
              <motion.div
                key={step}
                className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-primary">{step}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-base">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-16 px-6 md:px-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-12 text-balance">
          Everything you need to graduate on time
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              title: "Drag-and-drop planner",
              desc: "Rearrange courses between semesters instantly. Prereq warnings appear inline, no popups.",
              icon: Map,
            },
            {
              title: "Requirement tracking",
              desc: "Color-coded labels (Required, Group Choice, Elective) stay consistent everywhere in the app.",
              icon: CheckCircle,
            },
            {
              title: "Course browser",
              desc: "Browse your catalog by subject, level, and offered terms. Add directly to your plan.",
              icon: BookOpen,
            },
            {
              title: "Calendar view",
              desc: "Check for time conflicts between your section choices before registering.",
              icon: CalendarDays,
            },
          ].map(({ title, desc, icon: Icon }, index) => (
            <motion.div
              key={title}
              className="group flex gap-4 p-5 rounded-xl border border-border bg-card/80 hover:border-primary/30 transition-colors"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.1 }}
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center transition-transform group-hover:scale-105">
                <Icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-muted/40 border-y border-border py-16 px-6 md:px-12">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            { quote: "I finally understand what I need to take next semester. Brought this printout to my advisor and she loved it.", name: "Maya R.", major: "Biology, Junior" },
            { quote: "The prerequisite warnings saved me from registering for a class I wasn't ready for. It caught something my advisor missed.", name: "Tomas C.", major: "CS, Sophomore" },
            { quote: "I switched my major and Fiskpath rebuilt my whole plan in seconds. Would have been hours on a spreadsheet.", name: "Priya S.", major: "Economics to Data Science" },
          ].map(({ quote, name, major }, index) => (
            <motion.div
              key={name}
              className="flex flex-col gap-4 p-5 bg-card rounded-xl border border-border"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.1 }}
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">&ldquo;{quote}&rdquo;</p>
              <div>
                <p className="text-sm font-semibold text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">{major}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto rounded-3xl border border-border bg-card px-6 py-10 shadow-sm"
        >
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-4 text-balance">
            Know exactly where you stand before your next advisor meeting.
          </h2>
          <p className="text-muted-foreground mb-8">It takes less than 5 minutes to build your first plan.</p>
          <Link href="/onboarding">
            <Button size="lg" className="gap-2">
              Start Planning Free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-border py-6 px-6 md:px-12 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Fiskpath &copy; 2026</span>
        </div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

function PlannerPreview() {
  const semesters = [
    {
      label: "Fall 2024",
      current: true,
      courses: [
        { code: "CSCI-311", title: "Operating Systems", credits: 3, label: "required" as const },
        { code: "CSCI-420", title: "Compilers", credits: 3, label: "elective" as const },
        { code: "MATH-341", title: "Probability", credits: 3, label: "group" as const },
      ],
    },
    {
      label: "Spring 2025",
      current: false,
      courses: [
        { code: "CSCI-321", title: "Computer Networks", credits: 3, label: "required" as const },
        { code: "CSCI-350", title: "Machine Learning", credits: 3, label: "elective" as const },
        { code: "HIST-201", title: "World History", credits: 3, label: "general" as const },
      ],
    },
  ];

  const labelStyles: Record<string, string> = {
    required: "bg-red-50 text-red-700",
    elective: "bg-indigo-50 text-indigo-700",
    group: "bg-orange-50 text-orange-700",
    general: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-lg bg-card">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-muted/40">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-3 text-xs text-muted-foreground">Fiskpath · Planner</span>
        <span className="ml-auto text-[10px] text-green-600 font-medium flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Autosaved
        </span>
      </div>

      <div className="flex overflow-x-auto p-4 gap-3">
        {semesters.map((sem, index) => (
          <motion.div
            key={sem.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 + index * 0.08 }}
            className={`flex-shrink-0 w-48 rounded-lg border ${sem.current ? "border-primary/40 bg-primary/5" : "border-border bg-background"} p-3`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[11px] font-semibold ${sem.current ? "text-primary" : "text-foreground"}`}>
                {sem.label}
              </span>
              {sem.current && (
                <span className="text-[9px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {sem.courses.map((course, courseIndex) => (
                <motion.div
                  key={course.code}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.22 + courseIndex * 0.05 + index * 0.08 }}
                  whileHover={{ y: -2 }}
                  className="bg-card border border-border rounded-md px-2.5 py-2 flex items-start justify-between gap-2 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-foreground truncate">{course.code}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{course.title}</p>
                    <span className={`inline-block mt-1 text-[8px] font-medium px-1.5 py-0.5 rounded-full ${labelStyles[course.label]}`}>
                      {course.label === "required" ? "Required" : course.label === "elective" ? "Elective" : course.label === "group" ? "Group" : "Gen Ed"}
                    </span>
                  </div>
                  <span className="flex-shrink-0 text-[9px] font-mono font-semibold bg-muted text-muted-foreground rounded px-1 py-0.5 mt-0.5">
                    {course.credits}cr
                  </span>
                </motion.div>
              ))}
              <motion.button
                whileHover={{ y: -1 }}
                className="w-full text-[9px] text-muted-foreground border border-dashed border-border rounded-md py-1.5 hover:border-primary/40 hover:text-primary transition-colors mt-1"
              >
                + Add Course
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span><span className="font-semibold text-foreground">47</span> / 120 credits</span>
        <span className="h-3 w-px bg-border" />
        <span>GPA <span className="font-semibold text-foreground">3.42</span></span>
        <span className="h-3 w-px bg-border" />
        <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> On track · Spring 2026</span>
      </div>
    </div>
  );
}
