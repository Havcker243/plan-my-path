const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["my.fisk.edu"];

function getAllowedEmailDomains(): string[] {
  const configured = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS;
  if (!configured) return DEFAULT_ALLOWED_EMAIL_DOMAINS;
  return configured
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export const ALLOWED_EMAIL_DOMAINS = getAllowedEmailDomains();

export function isAllowedSchoolEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((domain) => normalized.endsWith(`@${domain}`));
}

export function allowedEmailDomainsText(): string {
  return ALLOWED_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(" or ");
}
