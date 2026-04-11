import {
  LayoutDashboard,
  Map,
  BookOpen,
  Flame,
  User,
  ClipboardList,
  CalendarDays,
  FileSpreadsheet,
} from "lucide-react";

/**
 * Single source of truth for app navigation items.
 *
 * Order matters:
 *   - Items 0–4  appear in the mobile bottom nav (slice(0, 5))
 *   - Items 5–7  are sidebar-only on mobile (hamburger menu)
 *   - All items  appear in the desktop sidebar and command search
 */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/planner", label: "Planner", icon: Map },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/hub", label: "Hub", icon: Flame },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/requirements", label: "Requirements", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/balance-sheet", label: "Balance Sheet", icon: FileSpreadsheet },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
