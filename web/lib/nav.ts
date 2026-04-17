import {
  LayoutDashboard,
  Route,
  BookOpen,
  MessageSquare,
  User,
  ClipboardCheck,
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
  { href: "/dashboard",     label: "Home",          icon: LayoutDashboard },
  { href: "/planner",       label: "Degree Plan",   icon: Route },
  { href: "/requirements",  label: "Requirements",  icon: ClipboardCheck },
  { href: "/courses",       label: "Courses",       icon: BookOpen },
  { href: "/calendar",      label: "Schedule",      icon: CalendarDays },
  { href: "/hub",           label: "Course Hub",    icon: MessageSquare },
  { href: "/balance-sheet", label: "Degree Audit",  icon: FileSpreadsheet },
  { href: "/profile",       label: "Profile",       icon: User },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
