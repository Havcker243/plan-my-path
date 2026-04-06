import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
