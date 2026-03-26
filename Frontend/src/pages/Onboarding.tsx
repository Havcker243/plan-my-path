import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  Calendar,
  Upload,
  CheckCircle2,
  BookOpen,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePlanner } from '@/contexts/PlannerContext';
import { useProfile, saveDraft, loadDraft, clearDraft } from '@/contexts/ProfileContext';
import { toast } from '@/hooks/use-toast';
import { fetchMajors, updateProfile, updatePlan } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { SemesterType } from '@/types/planner';

const steps = [
  { id: 1, title: 'Welcome', icon: Sparkles },
  { id: 2, title: 'Major', icon: BookOpen },
  { id: 3, title: 'Timeline', icon: Calendar },
  { id: 4, title: 'Courses', icon: Upload },
  { id: 5, title: 'Generate', icon: GraduationCap },
];

interface FormData {
  majorId: string;
  startYear: number;
  startTerm: string;
  graduationYear: number;
  graduationTerm: string;
  completedCourses: string[];
  gpa: string;
}

interface OnboardingDraft {
  step: number;
  formData: FormData;
}

interface FormErrors {
  majorId?: string;
  admittedYear?: string;
  targetGraduation?: string;
  gpa?: string;
}

const DEFAULT_FORM: FormData = {
  majorId: '',
  startYear: new Date().getFullYear(),
  startTerm: 'Fall',
  graduationYear: new Date().getFullYear() + 4,
  graduationTerm: 'Spring',
  completedCourses: [],
  gpa: '',
};

export function Onboarding() {
  const navigate = useNavigate();
  const { availableCourses, loadCourses, createSemester } = usePlanner();
  const { markComplete } = useProfile();
  const { accessToken, user } = useAuth();

  const [majorOptions, setMajorOptions] = useState<{ code: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let year = current - 5; year <= current + 5; year += 1) {
      years.push(year);
    }
    return years;
  }, []);

  // Load majors
  useEffect(() => {
    fetchMajors()
      .then(setMajorOptions)
      .catch((error) => console.error('Failed to load majors:', error));
  }, []);

  // Restore draft on mount (once user id is available)
  useEffect(() => {
    if (!user?.id) return;
    const draft = loadDraft<OnboardingDraft>(user.id);
    if (!draft) return;

    setFormData(draft.formData);
    setCurrentStep(Math.min(draft.step, steps.length));

    if (draft.formData.majorId && draft.formData.majorId !== 'UNDECLARED') {
      void loadCourses(draft.formData.majorId);
    }

    toast({
      title: 'Progress restored',
      description: 'We picked up where you left off.',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // intentionally runs once on mount

  // Save draft whenever formData or step changes (skip step 1 — nothing to save yet)
  useEffect(() => {
    if (!user?.id || currentStep < 2) return;
    saveDraft(user.id, { step: currentStep, formData });
  }, [formData, currentStep, user?.id]);

  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    if (step === 2 && !formData.majorId) {
      newErrors.majorId = 'Please select a major';
    }

    if (step === 3 && (!formData.graduationTerm || !formData.graduationYear)) {
      newErrors.targetGraduation = 'Please select a target graduation term';
    }

    if (step === 4 && formData.gpa !== '') {
      const gpaNum = Number(formData.gpa);
      if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4) {
        newErrors.gpa = 'GPA must be a number between 0 and 4';
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast({
        title: 'Please complete required fields',
        description: 'Fill in all required fields to continue.',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleComplete = async () => {
    if (!accessToken) return;
    setIsSaving(true);

    try {
      // Build the initial semester using PlannerContext (gets term calendar dates)
      const initialSemester = createSemester(
        formData.startTerm.toLowerCase() as SemesterType,
        formData.startYear
      );

      // Map selected course IDs to full objects for the plan payload
      const completedCourseObjects = formData.completedCourses
        .map((id) => availableCourses.find((c) => c.id === id || c.code === id))
        .filter(Boolean) as typeof availableCourses;

      const metadata = user?.user_metadata as { name?: string; phone?: string } | undefined;

      const profilePayload = {
        email: user?.email ?? undefined,
        name: metadata?.name ?? undefined,
        phone: metadata?.phone ?? undefined,
        major_code: formData.majorId,
        graduation_year: formData.graduationYear,
        graduation_term: formData.graduationTerm.toLowerCase(),
        start_year: formData.startYear,
        start_term: formData.startTerm.toLowerCase(),
        completed_courses: formData.completedCourses,
        gpa: formData.gpa ? Number(formData.gpa) : undefined,
      };

      // ── Confirmed saves ──────────────────────────────────────────────────────
      await updateProfile(accessToken, profilePayload);

      await updatePlan(accessToken, {
        name: 'My Academic Plan',
        semesters: [
          {
            id: initialSemester.id,
            type: initialSemester.type,
            year: initialSemester.year,
            label: initialSemester.label,
            startDate: initialSemester.startDate ?? null,
            endDate: initialSemester.endDate ?? null,
            courses: completedCourseObjects.map((course) => ({
              code: course.code,
              credits: course.credits,
              status: 'completed',
              grade: null,
              selectedSectionId: null,
            })),
          },
        ],
      });
      // ────────────────────────────────────────────────────────────────────────

      // Both saves confirmed — clear the draft and mark profile as complete.
      // markComplete calls hydrateProfile, which sets isOnboarded and triggers
      // the plan fetch from DB in PlannerContext.
      if (user?.id) clearDraft(user.id);
      markComplete(profilePayload);

      toast({
        title: 'Plan generated!',
        description: 'Your personalized academic plan is ready.',
      });
      navigate('/dashboard');
    } catch {
      toast({
        title: 'Failed to save',
        description: 'Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    setFormData((prev) => ({
      ...prev,
      completedCourses: prev.completedCourses.includes(courseId)
        ? prev.completedCourses.filter((id) => id !== courseId)
        : [...prev.completedCourses, courseId],
    }));
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Split by newlines, commas, or semicolons to handle various CSV formats
      const codes = text
        .split(/[\n,;\r]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const matched: string[] = [];
      const notFound: string[] = [];

      codes.forEach((code) => {
        const course = availableCourses.find((c) => c.code.toUpperCase() === code);
        if (course && !formData.completedCourses.includes(course.id)) {
          matched.push(course.id);
        } else if (!course) {
          notFound.push(code);
        }
      });

      if (matched.length > 0) {
        setFormData((prev) => ({
          ...prev,
          completedCourses: [...new Set([...prev.completedCourses, ...matched])],
        }));
      }

      toast({
        title: `Imported ${matched.length} course${matched.length === 1 ? '' : 's'}`,
        description:
          notFound.length > 0
            ? `${notFound.length} code${notFound.length === 1 ? '' : 's'} not found in catalog.`
            : 'All courses matched successfully.',
      });
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported if needed
    e.target.value = '';
  };

  const renderFieldError = (error?: string) => {
    if (!error) return null;
    return (
      <p className="text-sm text-destructive flex items-center gap-1 mt-1" role="alert">
        <AlertCircle className="w-3.5 h-3.5" />
        {error}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left sidebar with steps */}
      <div className="hidden lg:flex w-80 bg-primary p-8 flex-col">
        <div className="mb-12">
          <GraduationCap className="w-10 h-10 text-primary-foreground mb-4" />
          <h1 className="text-2xl font-bold text-primary-foreground">4-Year Planner</h1>
          <p className="text-primary-foreground/70 text-sm mt-2">Let's set up your plan</p>
        </div>

        <div className="space-y-4 flex-1">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                currentStep === step.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : currentStep > step.id
                  ? 'text-primary-foreground/70'
                  : 'text-primary-foreground/40'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep > step.id
                    ? 'bg-accent text-accent-foreground'
                    : currentStep === step.id
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'bg-primary-foreground/10'
                }`}
              >
                {currentStep > step.id ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <step.icon className="w-4 h-4" />
                )}
              </div>
              <span className="font-medium">{step.title}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-primary-foreground/50 mt-auto">
          Step {currentStep} of {steps.length}
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile progress */}
        <div className="lg:hidden p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              Step {currentStep} of {steps.length}
            </span>
            <span className="text-sm text-muted-foreground">{steps[currentStep - 1].title}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl"
            >
              {currentStep === 1 && (
                <Card className="border-border shadow-card">
                  <CardHeader className="text-center pb-8">
                    <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Sparkles className="w-10 h-10 text-accent" />
                    </div>
                    <CardTitle className="text-3xl">Welcome to your planner!</CardTitle>
                    <CardDescription className="text-base mt-2">
                      Let's create a personalized 4-year academic plan. This will only take a minute.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-muted-foreground mb-6">
                      We'll help you map out your courses, track prerequisites, and stay on track for
                      graduation.
                    </p>
                  </CardContent>
                </Card>
              )}

              {currentStep === 2 && (
                <Card className="border-border shadow-card">
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-accent" />
                      Choose your major
                    </CardTitle>
                    <CardDescription>
                      Pick one major to start. You can add minors later.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Major <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.majorId}
                        onValueChange={(value) => {
                          setFormData((prev) => ({ ...prev, majorId: value }));
                          setErrors((prev) => ({ ...prev, majorId: undefined }));
                          void loadCourses(value === 'UNDECLARED' ? null : value);
                        }}
                      >
                        <SelectTrigger className={errors.majorId ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Select your major" />
                        </SelectTrigger>
                        <SelectContent>
                          {majorOptions.map((option) => (
                            <SelectItem key={option.code} value={option.code}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {renderFieldError(errors.majorId)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentStep === 3 && (
                <Card className="border-border shadow-card">
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <Calendar className="w-6 h-6 text-accent" />
                      Set your timeline
                    </CardTitle>
                    <CardDescription>
                      When did you start and when do you plan to graduate?
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Admitted Year <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.startYear.toString()}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, startYear: parseInt(value, 10) }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
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

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Start Term <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.startTerm}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, startTerm: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select term" />
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
                      <Label className="flex items-center gap-1">
                        Graduation Term <span className="text-destructive">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={formData.graduationTerm}
                          onValueChange={(value) => {
                            setFormData((prev) => ({ ...prev, graduationTerm: value }));
                            setErrors((prev) => ({ ...prev, targetGraduation: undefined }));
                          }}
                        >
                          <SelectTrigger
                            className={errors.targetGraduation ? 'border-destructive' : ''}
                          >
                            <SelectValue placeholder="Term" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Spring">Spring</SelectItem>
                            <SelectItem value="Fall">Fall</SelectItem>
                            <SelectItem value="Summer">Summer</SelectItem>
                            <SelectItem value="Winter">Winter</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={formData.graduationYear.toString()}
                          onValueChange={(value) => {
                            setFormData((prev) => ({
                              ...prev,
                              graduationYear: parseInt(value, 10),
                            }));
                            setErrors((prev) => ({ ...prev, targetGraduation: undefined }));
                          }}
                        >
                          <SelectTrigger
                            className={errors.targetGraduation ? 'border-destructive' : ''}
                          >
                            <SelectValue placeholder="Year" />
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
                      {renderFieldError(errors.targetGraduation)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentStep === 4 && (
                <Card className="border-border shadow-card">
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <Upload className="w-6 h-6 text-accent" />
                      Add completed courses
                    </CardTitle>
                    <CardDescription>
                      Select courses you've already taken (optional).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between">
                        <Label>Search courses</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2 gap-1"
                          onClick={() => csvInputRef.current?.click()}
                        >
                          <Upload className="w-3 h-3" />
                          Import CSV
                        </Button>
                        <input
                          ref={csvInputRef}
                          type="file"
                          accept=".csv,.txt"
                          className="hidden"
                          onChange={handleCSVImport}
                        />
                      </div>
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search by code or keyword"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {formData.completedCourses.length > 0 ? (
                        formData.completedCourses.map((courseId) => {
                          const course = availableCourses.find((c) => c.id === courseId);
                          return course ? (
                            <Badge
                              key={courseId}
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => toggleCourse(courseId)}
                            >
                              {course.code} ×
                            </Badge>
                          ) : null;
                        })
                      ) : (
                        <p className="text-muted-foreground text-sm">No courses selected</p>
                      )}
                    </div>

                    <div className="border border-border rounded-lg max-h-64 overflow-y-auto custom-scrollbar">
                      {availableCourses
                        .filter((course) => {
                          const search = searchTerm.trim().toLowerCase();
                          if (!search) return true;
                          return (
                            course.code.toLowerCase().includes(search) ||
                            course.title.toLowerCase().includes(search) ||
                            (course.description ?? '').toLowerCase().includes(search)
                          );
                        })
                        .slice(0, 12)
                        .map((course) => (
                          <div
                            key={course.id}
                            onClick={() => toggleCourse(course.id)}
                            className={`flex items-center justify-between p-3 border-b border-border last:border-0 cursor-pointer transition-colors ${
                              formData.completedCourses.includes(course.id)
                                ? 'bg-accent/10'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div>
                              <p className="font-medium text-foreground">{course.code}</p>
                              <p className="text-sm text-muted-foreground">{course.title}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {course.credits} cr
                              </span>
                              {formData.completedCourses.includes(course.id) && (
                                <CheckCircle2 className="w-5 h-5 text-accent" />
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Click to select/deselect. Import CSV with one course code per line (e.g. CSCI-101).
                    </p>
                    <div className="mt-4 space-y-2">
                      <Label>Current GPA (optional)</Label>
                      <input
                        value={formData.gpa}
                        onChange={(event) => {
                          setFormData((prev) => ({ ...prev, gpa: event.target.value }));
                          setErrors((prev) => ({ ...prev, gpa: undefined }));
                        }}
                        placeholder="0.00 – 4.00"
                        className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${errors.gpa ? 'border-destructive' : 'border-border'}`}
                      />
                      {renderFieldError(errors.gpa)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentStep === 5 && (
                <Card className="border-border shadow-card">
                  <CardHeader className="text-center pb-8">
                    <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <GraduationCap className="w-10 h-10 text-accent" />
                    </div>
                    <CardTitle className="text-3xl">Ready to generate your plan!</CardTitle>
                    <CardDescription className="text-base mt-2">
                      We'll create a personalized 4-year plan based on your preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Major:</span>
                        <span className="font-medium text-foreground">
                          {majorOptions.find((o) => o.code === formData.majorId)?.name ||
                            formData.majorId}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Target Graduation:</span>
                        <span className="font-medium text-foreground">
                          {formData.graduationTerm} {formData.graduationYear}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Completed Courses:</span>
                        <span className="font-medium text-foreground">
                          {formData.completedCourses.length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="p-6 border-t border-border">
          <div className="max-w-xl mx-auto flex justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1 || isSaving}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            {currentStep < 5 ? (
              <Button
                onClick={handleNext}
                disabled={isSaving}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={isSaving}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    Generate Plan
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
