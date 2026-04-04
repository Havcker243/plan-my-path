"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Map,
  User,
  Bell,
  Search,
  Menu,
  X,
  GraduationCap,
  CheckCircle,
  ClipboardList,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { usePlan } from "@/contexts/plan-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/planner", label: "Planner", icon: Map },
  { href: "/requirements", label: "Requirements", icon: ClipboardList },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: User },
];

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
  const { profile, majors, loading: planLoading, initialized } = usePlan();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

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
    // Redirect to onboarding only after we've confirmed the profile exists
    // with no major set. An empty string major_code also counts as unset.
    if (!profile?.major_code?.trim()) {
      router.push("/onboarding");
    }
  }, [isLoading, user, profile, router]);

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

  const userName = profile?.name ?? user.email ?? "";
  const initials = getInitials(profile?.name ?? user.email);

  const majorName = majors.find((m) => m.code === profile?.major_code)?.name
    ?? profile?.major_code ?? null;

  const gradText =
    profile?.graduation_term && profile?.graduation_year
      ? `${profile.graduation_term.charAt(0).toUpperCase() + profile.graduation_term.slice(1)} ${profile.graduation_year}`
      : null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <GraduationCap className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-foreground tracking-tight text-[15px]">GradPath</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Bottom: graduation status + sign out */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
          {(majorName || gradText) && (
            <div className="flex flex-col gap-1 text-xs text-sidebar-foreground/50">
              {majorName && <span className="font-medium text-sidebar-foreground/70 truncate">{majorName}</span>}
              {gradText && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                  <span>On track · {gradText}</span>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors w-full"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
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
                <span className="font-semibold text-sidebar-foreground text-[15px]">GradPath</span>
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md border border-border text-sm text-muted-foreground cursor-pointer hover:border-primary/30 transition-colors">
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs">Search courses, requirements…</span>
              <span className="ml-auto text-xs font-mono bg-background border border-border px-1 rounded text-muted-foreground">⌘K</span>
            </div>
          </div>

          {/* Right: Bell + Avatar */}
          <div className="flex items-center gap-2 ml-4">
            <button
              className="relative p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell className="w-4.5 h-4.5" />
            </button>

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

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden bg-sidebar border-t border-sidebar-border">
        {NAV_ITEMS.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
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
