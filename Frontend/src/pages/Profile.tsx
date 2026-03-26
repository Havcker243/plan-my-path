import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMajors, fetchProfile, searchCourses, updateProfile } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { usePlanner } from '@/contexts/PlannerContext';
import { AppLayout } from '@/components/layout/AppLayout';

type MajorOption = { code: string; name: string };

export function Profile() {
  const { accessToken, user } = useAuth();
  const { hydrateProfile } = usePlanner();
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [courseQuery, setCourseQuery] = useState('');
  const [courseResults, setCourseResults] = useState<{ course_code: string; title: string }[]>([]);
  const [form, setForm] = useState({
    name: '',
    avatar_url: '',
    phone: '',
    major_code: 'UNDECLARED',
    graduation_year: new Date().getFullYear() + 4,
    graduation_term: 'Spring',
    start_year: new Date().getFullYear(),
    start_term: 'Fall',
    gpa: '',
    completed_courses: [] as string[],
  });

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let year = current - 5; year <= current + 5; year += 1) {
      years.push(year);
    }
    return years;
  }, []);

  useEffect(() => {
    fetchMajors().then(setMajors).catch(() => setMajors([{ code: 'UNDECLARED', name: 'Undeclared' }]));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    fetchProfile(accessToken)
      .then((profile) => {
        if (!profile) return;
        setForm((prev) => ({
          ...prev,
          name: profile.name ?? '',
          avatar_url: profile.avatar_url ?? '',
          phone: profile.phone ?? '',
          major_code: profile.major_code ?? 'UNDECLARED',
          graduation_year: profile.graduation_year ?? prev.graduation_year,
          graduation_term: profile.graduation_term
            ? profile.graduation_term.charAt(0).toUpperCase() + profile.graduation_term.slice(1).toLowerCase()
            : prev.graduation_term,
          start_year: profile.start_year ?? prev.start_year,
          start_term: profile.start_term
            ? profile.start_term.charAt(0).toUpperCase() + profile.start_term.slice(1).toLowerCase()
            : prev.start_term,
          gpa: profile.gpa ? String(profile.gpa) : '',
          completed_courses: profile.completed_courses ?? [],
        }));
      })
      .catch((error) => console.error('Failed to load profile:', error));
  }, [accessToken]);

  useEffect(() => {
    const trimmed = courseQuery.trim();
    if (!trimmed) {
      setCourseResults([]);
      return;
    }

    searchCourses(trimmed, form.major_code === 'UNDECLARED' ? undefined : form.major_code, 1, 10)
      .then((response) => {
        setCourseResults(response.data.map((item) => ({
          course_code: item.course_code,
          title: item.title ?? '',
        })));
      })
      .catch((error) => console.error('Course search failed:', error));
  }, [courseQuery, form.major_code]);

  const handleSave = async () => {
    if (!accessToken) return;

    // Validate GPA before saving
    const gpaValue = form.gpa ? Number(form.gpa) : undefined;
    if (form.gpa && (isNaN(gpaValue!) || gpaValue! < 0 || gpaValue! > 4)) {
      toast({
        title: 'Invalid GPA',
        description: 'GPA must be a number between 0 and 4.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const profilePayload = {
        email: user?.email ?? undefined,
        name: form.name,
        avatar_url: form.avatar_url,
        phone: form.phone,
        major_code: form.major_code,
        graduation_year: form.graduation_year,
        graduation_term: form.graduation_term.toLowerCase(),
        start_year: form.start_year,
        start_term: form.start_term.toLowerCase(),
        gpa: gpaValue,
        completed_courses: form.completed_courses,
      };
      await updateProfile(accessToken, profilePayload);
      // Sync updated profile back into PlannerContext so Planner/Dashboard refresh
      hydrateProfile(profilePayload);
      toast({ title: 'Profile saved' });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCompleted = (courseCode: string) => {
    if (form.completed_courses.includes(courseCode)) return;
    setForm((prev) => ({
      ...prev,
      completed_courses: [...prev.completed_courses, courseCode],
    }));
  };

  const handleRemoveCompleted = (courseCode: string) => {
    setForm((prev) => ({
      ...prev,
      completed_courses: prev.completed_courses.filter((code) => code !== courseCode),
    }));
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const bucket = (import.meta.env.VITE_SUPABASE_AVATAR_BUCKET
      || import.meta.env.SUPABASE_AVATAR_BUCKET
      || import.meta.env.Supabase_Avatar_Bucket) as string | undefined;
    if (!bucket) {
      toast({
        title: 'Missing bucket',
        description: 'Set SUPABASE_AVATAR_BUCKET (or Supabase_Avatar_Bucket) to upload avatars.',
        variant: 'destructive',
      });
      return;
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `avatars/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
    });
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setForm((prev) => ({ ...prev, avatar_url: data.publicUrl }));
  };

  return (
    <AppLayout>
    <div className="px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="border-border shadow-card">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal and academic details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ''} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Avatar URL</Label>
              <div className="flex flex-col gap-2">
                <Input
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                  placeholder="https://..."
                />
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleAvatarUpload(file);
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label>Major</Label>
              <Select
                value={form.major_code}
                onValueChange={(value) => setForm({ ...form, major_code: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select major" />
                </SelectTrigger>
                <SelectContent>
                  {majors.map((major) => (
                    <SelectItem key={major.code} value={major.code}>
                      {major.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Term</Label>
                <Select
                  value={form.start_term}
                  onValueChange={(value) => setForm({ ...form, start_term: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Start term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fall">Fall</SelectItem>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                    <SelectItem value="Winter">Winter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Year</Label>
                <Select
                  value={form.start_year.toString()}
                  onValueChange={(value) => setForm({ ...form, start_year: parseInt(value, 10) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Start year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Graduation Term</Label>
                <Select
                  value={form.graduation_term}
                  onValueChange={(value) => setForm({ ...form, graduation_term: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Graduation term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="Fall">Fall</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                    <SelectItem value="Winter">Winter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Graduation Year</Label>
                <Select
                  value={form.graduation_year.toString()}
                  onValueChange={(value) => setForm({ ...form, graduation_year: parseInt(value, 10) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Graduation year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Current GPA</Label>
              <Input
                value={form.gpa}
                onChange={(e) => setForm({ ...form, gpa: e.target.value })}
                placeholder="3.5"
              />
            </div>

            <div className="space-y-3">
              <Label>Completed courses</Label>
              <Input
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder="Search by course code or keyword"
              />
              <div className="flex flex-wrap gap-2">
                {form.completed_courses.length === 0 && (
                  <span className="text-sm text-muted-foreground">No courses added yet.</span>
                )}
                {form.completed_courses.map((course) => (
                  <Button
                    key={course}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRemoveCompleted(course)}
                  >
                    {course} x
                  </Button>
                ))}
              </div>
              {courseResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                  {courseResults.slice(0, 10).map((course) => (
                    <button
                      key={course.course_code}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                      onClick={() => handleAddCompleted(course.course_code)}
                    >
                      <div className="font-medium">{course.course_code}</div>
                      <div className="text-muted-foreground">{course.title}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
              Save profile
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    </AppLayout>
  );
}
