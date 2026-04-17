// All calls to the FastAPI backend at NEXT_PUBLIC_API_BASE_URL

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
let subjectsCache: Major[] | null = null;
let subjectsPromise: Promise<Major[]> | null = null;

async function get<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(detail.detail ?? `POST ${path} → ${res.status}`);
  }
  return res.json();
}

// ─── Types matching backend responses ────────────────────────────────────────

export interface Major {
  code: string;
  name: string;
  degree_type?: string | null;
  total_credits_required?: number | null;
}

export interface BackendCourse {
  id: string;
  course_code: string;
  title: string | null;
  description: string | null;
  credits: { min_credits: number | null; max_credits: number | null; credit_type: string | null };
  requisites: unknown;
  sections: BackendSection[];
}

export interface BackendSection {
  id: string;
  section_code: string;
  section_id: string;
  term: string;
  status: string | null;
  campus: string | null;
  modality: string | null;
  start_date: string | null;
  end_date: string | null;
  seats: { available: number; capacity: number; enrolled: number | null; waitlisted: number | null };
  instructors: { name: string; faculty_id: string | null; role: string | null }[];
  meeting_times: {
    days: string | null;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    building: string | null;
    room: string | null;
    modality: string | null;
    start_date: string | null;
    end_date: string | null;
  }[];
}

export interface BackendPlanCourse {
  id: string;
  code: string;
  title: string;
  credits: number;
  description: string | null;
  prerequisites: string[];
  offeredTerms: string[];
  type: string;
  requirementBucket: string | null;
  status: "planned" | "completed" | "failed";
  grade: string | null;
  semesterId: string;
  selectedSectionId: string | null;
}

export interface BackendSemester {
  id: string;
  term: string;
  year: number;
  label: string;
  start_date: string | null;
  end_date: string | null;
  courses: BackendPlanCourse[];
}

export interface BackendPlan {
  id: string;
  name: string;
  semesters: BackendSemester[];
}

export interface BackendProfile {
  user_id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  major_code: string | null;
  minor_code: string | null;
  graduation_year: number | null;
  graduation_term: string | null;
  start_year: number | null;
  start_term: string | null;
  completed_courses: string[];
  gpa: number | null;
}

export interface CourseLabelEntry {
  label: "Required" | "Group Choice" | "Major Elective" | "General Elective";
  group_name: string;
  group_type: string;
  detail: string;
  credits: number | null;
  credits_required_min?: number | null;
  credits_required_max?: number | null;
  courses_required?: number | null;
}

export interface ElectiveRule {
  subject_code: string;
  min_level: number;
  max_level: number | null;
  exclude_courses: string[];
  group_name: string;
}

export interface CourseLabelsResponse {
  labels: Record<string, CourseLabelEntry>;
  rules: ElectiveRule[];
  total_credits: number;
}

export interface TermCalendarEntry {
  term: string;
  year: number;
  start_date: string | null;
  end_date: string | null;
}

export interface BackendSubjectCourse {
  id: string;
  code: string;
  title: string;
  credits: number;
  description: string | null;
  prerequisites: string[];
  offeredTerms: string[];
  type: string;
  requirementBucket: string | null;
}

// ─── Public endpoints ─────────────────────────────────────────────────────────

export async function fetchMajors(): Promise<Major[]> {
  const res = await get<{ data: Major[] }>("/api/majors");
  return res.data;
}

export async function fetchSubjects(): Promise<Major[]> {
  if (subjectsCache) return subjectsCache;
  if (!subjectsPromise) {
    subjectsPromise = get<{ data: Major[] }>("/api/subjects")
      .then((res) => {
        subjectsCache = res.data;
        return res.data;
      })
      .finally(() => {
        subjectsPromise = null;
      });
  }
  return subjectsPromise;
}

export async function fetchCoursesBySubject(subject: string): Promise<BackendSubjectCourse[]> {
  const params = new URLSearchParams({ subject });
  const res = await get<{ data: BackendSubjectCourse[] }>(`/api/courses?${params}`);
  return res.data;
}

export async function searchCourses(
  query: string,
  subject?: string,
  page = 1,
  limit = 50
): Promise<{ data: BackendCourse[]; total: number }> {
  const params = new URLSearchParams({ query, page: String(page), limit: String(limit) });
  if (subject) params.set("subject", subject);
  const res = await get<{ data: BackendCourse[]; total: number }>(`/api/courses/search?${params}`);
  return res;
}

export async function fetchSections(
  courseCodes: string[],
  term?: string
): Promise<Record<string, BackendSection[]>> {
  const params = new URLSearchParams({ course_codes: courseCodes.join(",") });
  if (term) params.set("term", term);
  const res = await get<{ data: Record<string, BackendSection[]> }>(`/api/sections?${params}`);
  return res.data;
}

export async function fetchTermCalendar(): Promise<TermCalendarEntry[]> {
  const res = await get<{ data: TermCalendarEntry[] }>("/api/terms");
  return res.data;
}

export async function fetchCourseLabels(
  majorCode: string
): Promise<CourseLabelsResponse> {
  const res = await get<{ data: Record<string, CourseLabelEntry>; rules: ElectiveRule[]; total_credits?: number }>(
    `/api/course-labels?major_code=${encodeURIComponent(majorCode)}`
  );
  return { labels: res.data ?? {}, rules: res.rules ?? [], total_credits: res.total_credits ?? 120 };
}

// ─── Transcript parsing ───────────────────────────────────────────────────────

export interface ParsedTranscriptCourse {
  rowId: string;
  code: string;       // e.g. "CSCI 110"
  title: string;      // e.g. "Intro to Computer Science I"
  grade: string | null;      // e.g. "A-" or null for in-progress/current term
  credits: number | null;
  term: string | null;       // "Fall" | "Spring" | "Summer" | "Winter" | null for transfer
  year: number | null;
  status: "completed" | "planned";
  sourceType: "term" | "transfer";
}

export interface ParsedTranscript {
  student_name: string | null;
  gpa: number | null;
  courses: ParsedTranscriptCourse[];
}

// ─── Course reviews ───────────────────────────────────────────────────────────

export interface CourseReview {
  id: string;
  course_code: string;
  year_taken: number | null;
  term_taken: string | null;
  professor: string | null;
  comment: string;
  helpful_count: number;
  created_at: string | null;
}

export async function fetchReviews(courseCode: string): Promise<CourseReview[]> {
  const res = await get<{ data: CourseReview[] }>(`/api/reviews?course_code=${encodeURIComponent(courseCode)}`);
  return res.data ?? [];
}

export async function fetchRecentReviews(limit = 20): Promise<CourseReview[]> {
  const res = await get<{ data: CourseReview[] }>(`/api/reviews/recent?limit=${limit}`);
  return res.data ?? [];
}

export async function submitReview(
  token: string,
  payload: {
    course_code: string;
    year_taken?: number | null;
    term_taken?: string | null;
    professor?: string | null;
    comment: string;
  }
): Promise<CourseReview> {
  const res = await post<{ data: CourseReview }>("/api/reviews", payload, token);
  return res.data;
}

export async function parseTranscriptPDF(file: File): Promise<ParsedTranscript> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/transcript`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `Parse failed (${res.status})`);
  }
  const json = await res.json() as { data: ParsedTranscript };
  return json.data;
}

// ─── AI Advisor ───────────────────────────────────────────────────────────────

export interface AdvisorMessage {
  role: "user" | "assistant";
  content: string;
}

export class AdvisorBusyError extends Error {
  constructor() { super("ADVISOR_BUSY"); }
}

export async function callAdvisor(
  token: string,
  message: string,
  history: AdvisorMessage[] = [],
  onChunk?: (chunk: string) => void
): Promise<string> {
  const res = await fetch(`${BASE}/api/ai/advise`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new AdvisorBusyError();
    throw new Error(`POST /api/ai/advise → ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return full;
      try {
        const parsed = JSON.parse(raw) as { chunk?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.chunk) {
          full += parsed.chunk;
          onChunk?.(parsed.chunk);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  return full;
}

// ─── Authenticated endpoints ──────────────────────────────────────────────────

export async function deleteAccount(token: string): Promise<void> {
  const res = await fetch(`${BASE}/api/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(detail.detail ?? `DELETE /api/account → ${res.status}`);
  }
}

export async function fetchProfile(token: string): Promise<BackendProfile | null> {
  const res = await get<{ data: BackendProfile | null }>("/api/profile", token);
  return res.data;
}

export async function updateProfile(
  token: string,
  payload: Partial<BackendProfile> & { user_id?: string }
): Promise<BackendProfile> {
  const res = await put<{ data: BackendProfile }>("/api/profile", payload, token);
  return res.data;
}

export async function fetchPlan(token: string): Promise<BackendPlan | null> {
  const res = await get<{ data: BackendPlan | null }>("/api/plan", token);
  return res.data;
}

export async function savePlan(
  token: string,
  payload: {
    name?: string;
    semesters: {
      id: string;
      type: string;
      year: number;
      label: string;
      startDate: string | null;
      endDate: string | null;
      courses: {
        code: string;
        credits: number;
        status: string;
        grade: string | null;
        selectedSectionId: string | null;
      }[];
    }[];
  }
): Promise<BackendPlan | null> {
  const res = await put<{ data: BackendPlan | null }>("/api/plan", payload, token);
  return res.data;
}
