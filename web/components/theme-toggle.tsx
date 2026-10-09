"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button type="button" disabled={!mounted} onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label} title={label}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 print:hidden">
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}

export function PublicThemeToggle() {
  const pathname = usePathname();
  if (pathname === "/" || NAV_ITEMS.some(({ href }) => pathname === href || pathname.startsWith(href + "/"))) return null;
  return <div className="fixed bottom-4 right-4 z-40 rounded-xl border bg-background shadow-sm print:hidden"><ThemeToggle /></div>;
}
