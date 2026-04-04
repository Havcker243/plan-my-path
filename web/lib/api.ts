// All calls to the FastAPI backend at NEXT_PUBLIC_API_BASE_URL

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

// ─── Types matching backend responses ────────────────────────────────────────

export interface Major {
  code: string;
  name: string;
}

export interface BackendCourse {
  id: string;
  course_code: string;
  title: string | null;
  description: string | null;
  credits: { min_credits: number | null; max_credits: number | null };
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
}

export interface TermCalendarEntry {
  term: string;
  year: number;
  start_date: string | null;
  end_date: string | null;
}

// ─── Public endpoints ─────────────────────────────────────────────────────────

export async function fetchMajors(): Promise<Major[]> {
  const res = await get<{ data: Major[] }>("/api/majors");
  return res.data;
}

export async function fetchSubjects(): Promise<Major[]> {
  const res = await get<{ data: Major[] }>("/api/subjects");
  return res.data;
}

export async function fetchCoursesBySubject(subject: string): Promise<BackendCourse[]> {
  const res = await get<{ data: BackendCourse[] }>(`/api/courses?subject=${encodeURIComponent(subject)}`);
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
): Promise<Record<string, CourseLabelEntry>> {
  const res = await get<{ data: Record<string, CourseLabelEntry> }>(
    `/api/course-labels?major_code=${encodeURIComponent(majorCode)}`
  );
  return res.data;
}

// ─── Authenticated endpoints ──────────────────────────────────────────────────

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
