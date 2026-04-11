import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function formatDisplayName(value: string | null | undefined) {
  if (!value) return value
  const trimmed = value.trim()
  if (!trimmed) return trimmed

  // Only normalize strings that are effectively all-caps words.
  const lettersOnly = trimmed.replace(/[^A-Za-z]+/g, "")
  if (!lettersOnly || lettersOnly !== lettersOnly.toUpperCase()) {
    return trimmed
  }

  return trimmed
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
