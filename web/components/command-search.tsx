"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Map,
  ClipboardList,
  CalendarDays,
  User,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { usePlan } from "@/contexts/plan-context";
import { cn } from "@/lib/utils";
import type { Course } from "@/lib/data";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/planner", label: "Planner", icon: Map },
  { href: "/requirements", label: "Requirements", icon: ClipboardList },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: User },
];

const LABEL_DOT: Record<string, string> = {
  required: "bg-red-500",
  group: "bg-orange-500",
  elective: "bg-indigo-500",
  general: "bg-slate-400",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandSearch({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { searchCoursesCatalog } = usePlan();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Course[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchCoursesCatalog(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchCoursesCatalog]);

  const go = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search courses or navigate to a page"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Search courses, requirements…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.length < 2 && (
          <CommandGroup heading="Navigation">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} value={label} onSelect={() => go(href)}>
                <Icon className="w-4 h-4" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searching && (
          <p className="py-4 text-center text-xs text-muted-foreground">Searching…</p>
        )}

        {!searching && results.length > 0 && (
          <>
            {query.length >= 2 && <CommandSeparator />}
            <CommandGroup heading="Courses">
              {results.slice(0, 8).map((course) => (
                <CommandItem
                  key={course.code}
                  value={`${course.code} ${course.title}`}
                  onSelect={() => go("/courses")}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      LABEL_DOT[course.label] ?? "bg-slate-400"
                    )}
                  />
                  <span className="font-medium">{course.code}</span>
                  <span className="text-muted-foreground truncate flex-1">{course.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto pl-2 flex-shrink-0">
                    {course.credits}cr
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!searching && query.length >= 2 && results.length === 0 && (
          <CommandEmpty>No courses found for &quot;{query}&quot;</CommandEmpty>
        )}
      </CommandList>
    </CommandDialog>
  );
}
