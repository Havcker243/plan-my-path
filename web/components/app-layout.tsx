"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Search,
  Menu,
  X,
  GraduationCap,
  CheckCircle,
  LogOut,
  AlertTriangle,
  Zap,
  BookMarked,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePlan } from "@/contexts/plan-context";
import { getPrereqWarnings, getTotalCredits, getOfferedTermWarnings } from "@/lib/data";
import CommandSearch from "@/components/command-search";
import { NAV_ITEMS } from "@/lib/nav";
import { allowedEmailDomainsText, isAllowedSchoolEmail } from "@/lib/email-access";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, semesters, planCatalog, labels, loading: planLoading, initialized, initError, profileLoaded } = usePlan();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setSidebarCollapsed(true);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });
  };
  const bellRef = useRef<HTMLButtonElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close notification panel on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !bellRef.current?.contains(e.target as Node) &&
        !notifPanelRef.current?.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  // ── Notifications ────────────────────────────────────────────────────────────
  const prereqWarnings = getPrereqWarnings(semesters, planCatalog);
  const offeredTermWarnings = getOfferedTermWarnings(semesters, planCatalog);

  const overloadedSemesters = semesters.filter(
    (s) => !s.isPast && getTotalCredits(s.courseIds, planCatalog) > 18
  );

  const scheduledCodes = new Set(semesters.flatMap((s) => s.courseIds));
  const missingRequired = Object.entries(labels)
    .filter(([code, entry]) => entry.label === "Required" && !scheduledCodes.has(code))
    .map(([code]) => code);

  const totalNotifs = prereqWarnings.length + offeredTermWarnings.length + overloadedSemesters.length + missingRequired.length;

  // Wait for auth AND for at least one full plan-fetch cycle to complete.
  // Without `initialized`, there's a window after auth resolves where planLoading
  // is still false (hasn't started yet) and profile is null — causing a premature
  // redirect to /onboarding for legitimate users.
  const isLoading = authLoading || (!!user && (!initialized || planLoading));

  // Auth guard
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!isAllowedSchoolEmail(user.email)) {
      signOut().finally(() => router.push("/login"));
      return;
    }
    // Only redirect to onboarding when the backend successfully confirmed
    // the user has no major set. Never redirect on a fetch failure.
    if (profileLoaded && !profile?.major_code?.trim()) {
      router.push("/onboarding");
    }
  }, [isLoading, user, profile, router, profileLoaded, signOut]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <GraduationCap className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAllowedSchoolEmail(user.email)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs px-4">
          <GraduationCap className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Fisk email required</p>
          <p className="text-xs text-muted-foreground">
            Sign in with {allowedEmailDomainsText()} to use FiskGrad.
          </p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs px-4">
          <GraduationCap className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Couldn&apos;t load your plan</p>
          <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-primary hover:underline mt-1"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const userName = profile?.name ?? user.email ?? "";
  const initials = getInitials(profile?.name ?? user.email);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar (desktop) ── */}
      <aside className={cn(
        "hidden md:flex flex-col flex-shrink-0 bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-in-out overflow-hidden",
        sidebarCollapsed ? "w-14" : "w-56"
      )}>
        {/* Logo — click to collapse/expand */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center gap-2.5 border-b border-sidebar-border h-14 flex-shrink-0 px-3 w-full hover:bg-sidebar-accent transition-colors"
        >
          <div className="flex items-center justify-center w-7 h-7 bg-primary rounded-lg flex-shrink-0">
            <GraduationCap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-sidebar-foreground tracking-tight text-[15px] truncate">FiskGrad</span>
          )}
        </button>

        {/* Nav */}
        <nav className={cn("flex-1 py-3 space-y-0.5 overflow-hidden", sidebarCollapsed ? "px-2" : "px-2")}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                title={sidebarCollapsed ? label : undefined}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium transition-colors",
                  sidebarCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: sign out */}
        <div className={cn(
          "border-t border-sidebar-border",
          sidebarCollapsed ? "px-2 py-3 flex justify-center" : "px-4 py-3"
        )}>
          <button
            onClick={() => signOut()}
            title={sidebarCollapsed ? "Sign out" : undefined}
            className={cn(
              "flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors",
              sidebarCollapsed ? "justify-center w-8 h-8 rounded-md hover:bg-sidebar-accent" : "w-full"
            )}
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            {!sidebarCollapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-sidebar h-full shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sidebar-foreground text-[15px]">FiskGrad</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/60 hover:text-sidebar-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    pathname === href
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-sidebar-border">
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-border bg-background flex-shrink-0">
          <button
            className="md:hidden mr-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Global search */}
          <div className="flex-1 max-w-sm">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md border border-border text-sm text-muted-foreground cursor-pointer hover:border-primary/30 transition-colors"
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs">Search courses, requirements…</span>
              <span className="ml-auto text-xs font-mono bg-background border border-border px-1 rounded text-muted-foreground">⌘K</span>
            </button>
          </div>

          {/* Right: Bell + Avatar */}
          <div className="flex items-center gap-2 ml-4">
            <div className="relative">
              <button
                ref={bellRef}
                className="relative p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <Bell className="w-4 h-4" />
                {totalNotifs > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>

              {/* Notification panel */}
              {notifOpen && (
                <div
                  ref={notifPanelRef}
                  className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground">Notifications</p>
                    {totalNotifs === 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">You&apos;re all clear.</p>
                    )}
                  </div>

                  {totalNotifs > 0 ? (
                    <div className="max-h-72 overflow-y-auto divide-y divide-border">
                      {overloadedSemesters.map((s) => (
                        <div key={s.id} className="flex gap-3 px-4 py-3 items-start">
                          <Zap className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {s.term} {s.year} is overloaded
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {getTotalCredits(s.courseIds, planCatalog)} credits — aim for 12–18
                            </p>
                          </div>
                        </div>
                      ))}

                      {prereqWarnings.map((w, i) => (
                        <div key={i} className="flex gap-3 px-4 py-3 items-start">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              Prerequisite issue: {w.courseId}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {w.prereqId} must be taken before {w.courseId}
                            </p>
                          </div>
                        </div>
                      ))}

                      {offeredTermWarnings.map((w, i) => (
                        <div key={i} className="flex gap-3 px-4 py-3 items-start">
                          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {w.courseId} may not be offered in {w.semesterTerm}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Check the catalog before registering
                            </p>
                          </div>
                        </div>
                      ))}

                      {missingRequired.slice(0, 5).map((code) => (
                        <div key={code} className="flex gap-3 px-4 py-3 items-start">
                          <BookMarked className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {code} not in plan
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Required for your major
                            </p>
                          </div>
                        </div>
                      ))}
                      {missingRequired.length > 5 && (
                        <div className="px-4 py-2 text-[11px] text-muted-foreground">
                          +{missingRequired.length - 5} more missing required courses
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-6 flex flex-col items-center gap-2">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                      <p className="text-xs text-muted-foreground text-center">
                        No warnings. Your plan looks good.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Avatar */}
            <Link href="/profile">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                {initials}
              </div>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* ── Command search ── */}
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden bg-sidebar border-t border-sidebar-border pb-safe">
        {NAV_ITEMS.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-medium transition-colors",
              pathname === href
                ? "text-sidebar-primary-foreground"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
