const defaultBaseUrl = 'http://localhost:8000';

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? defaultBaseUrl;

export type ApiCourse = {
  id: string;
  code: string;
  title: string;
  credits: number;
  description?: string | null;
  prerequisites?: string[];
  offeredTerms: Array<'fall' | 'spring' | 'summer' | 'winter'>;
  type: 'core' | 'elective' | 'general';
  requirementBucket?: string | null;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function fetchCourses(subject: string): Promise<ApiCourse[]> {
  const payload = await request<{ data: ApiCourse[] }>(
    `/api/courses?subject=${encodeURIComponent(subject)}`
  );
  return payload.data ?? [];
}

export type SearchCourse = {
  course_code: string;
  title: string;
  description?: string | null;
  credits?: {
    min_credits?: number | null;
    max_credits?: number | null;
    credit_type?: string | null;
  };
  requisites?: unknown;
  locations?: string | null;
  attributes?: unknown;
  sections?: unknown[];
};

export type SearchResponse = {
  data: SearchCourse[];
  page: number;
  limit: number;
  total: number;
};

export async function searchCourses(
  query: string,
  subject?: string,
  page: number = 1,
  limit: number = 25
): Promise<SearchResponse> {
  const params = new URLSearchParams({ query, page: String(page), limit: String(limit) });
  if (subject) params.set('subject', subject);
  return request<SearchResponse>(`/api/courses/search?${params.toString()}`);
}

export type MajorOption = {
  code: string;
  name: string;
};

export async function fetchMajors(): Promise<MajorOption[]> {
  const payload = await request<{ data: MajorOption[] }>('/api/majors');
  return payload.data ?? [];
}

export type ProfilePayload = {
  email?: string;
  name?: string;
  phone?: string;
  avatar_url?: string;
  major_code?: string;
  graduation_year?: number;
  graduation_term?: string;
  start_year?: number;
  start_term?: string;
  completed_courses?: string[];
  gpa?: number;
};

export async function fetchProfile(token: string): Promise<ProfilePayload | null> {
  const payload = await request<{ data: ProfilePayload | null }>(
    '/api/profile',
    {},
    token
  );
  return payload.data ?? null;
}

export async function updateProfile(
  token: string,
  profile: ProfilePayload
): Promise<ProfilePayload> {
  const payload = await request<{ data: ProfilePayload }>(
    '/api/profile',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    },
    token
  );
  return payload.data;
}

export type SectionResult = Record<string, unknown[]>;

export async function fetchSections(courseCodes: string[]): Promise<SectionResult> {
  if (courseCodes.length === 0) return {};
  const params = new URLSearchParams({
    course_codes: courseCodes.join(','),
  });
  const payload = await request<{ data: SectionResult }>(`/api/sections?${params.toString()}`);
  return payload.data ?? {};
}

export async function fetchSectionsForTerm(
  courseCodes: string[],
  term: string
): Promise<SectionResult> {
  if (courseCodes.length === 0) return {};
  const params = new URLSearchParams({
    course_codes: courseCodes.join(','),
    term,
  });
  const payload = await request<{ data: SectionResult }>(`/api/sections?${params.toString()}`);
  return payload.data ?? {};
}

export type TermCalendarEntry = {
  term: string;
  year: number;
  start_date: string;
  end_date: string;
};

export async function fetchTermCalendar(): Promise<TermCalendarEntry[]> {
  const payload = await request<{ data: TermCalendarEntry[] }>('/api/terms');
  return payload.data ?? [];
}

export type PlanResponse = {
  id: string;
  name: string;
  semesters: Array<{
    id: string;
    term: string;
    year: number;
    label: string;
    start_date?: string | null;
    end_date?: string | null;
    courses: Array<{
      id: string;
      code: string;
      title: string;
      credits: number;
      description?: string | null;
      prerequisites?: string[];
      offeredTerms?: Array<'fall' | 'spring' | 'summer' | 'winter'>;
      type?: 'core' | 'elective' | 'general';
      requirementBucket?: string | null;
      status: string;
      grade?: string | null;
      semesterId?: string | null;
      selectedSectionId?: string | null;
    }>;
  }>;
};

export async function fetchPlan(token: string): Promise<PlanResponse | null> {
  const payload = await request<{ data: PlanResponse | null }>(
    '/api/plan',
    {},
    token
  );
  return payload.data ?? null;
}

export async function updatePlan(
  token: string,
  plan: { name?: string; semesters: unknown[] }
): Promise<PlanResponse | null> {
  const payload = await request<{ data: PlanResponse | null }>(
    '/api/plan',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    },
    token
  );
  return payload.data ?? null;
}

// Course Labels Types
export type CourseLabel = {
  label: 'Required' | 'Group Choice' | 'Major Elective' | 'General Elective';
  group_name: string;
  group_type: string;
  detail: string;
  credits: number | null;
};

export type CourseLabelsResponse = {
  [courseCode: string]: CourseLabel;
};

/**
 * Fetch course labels for a specific major
 * @param majorCode - Major code (e.g., "CSCI")
 * @param courseCodes - Optional array of course codes to label
 * @returns Object mapping course codes to their labels
 */
export async function fetchCourseLabels(
  majorCode: string,
  courseCodes?: string[]
): Promise<CourseLabelsResponse> {
  const params = new URLSearchParams({ major_code: majorCode });

  if (courseCodes && courseCodes.length > 0) {
    params.set('course_codes', courseCodes.join(','));
  }

  const payload = await request<{ data: CourseLabelsResponse }>(
    `/api/course-labels?${params.toString()}`
  );

  return payload.data ?? {};
}
