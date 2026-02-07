import { useMemo, useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePlanner } from '@/contexts/PlannerContext';
import { toast } from '@/hooks/use-toast';
import { fetchMajors, updateProfile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const steps = [
  { id: 1, title: 'Welcome', icon: Sparkles },
  { id: 2, title: 'Major', icon: BookOpen },
  { id: 3, title: 'Timeline', icon: Calendar },
  { id: 4, title: 'Courses', icon: Upload },
  { id: 5, title: 'Generate', icon: GraduationCap },
];

interface FormErrors {
  majorId?: string;
  admittedYear?: string;
  targetGraduation?: string;
}

export function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding, availableCourses, loadCourses } = usePlanner();
  const { accessToken, user } = useAuth();
  const [majorOptions, setMajorOptions] = useState<{ code: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    majorId: '',
    startYear: new Date().getFullYear(),
    startTerm: 'Fall',
    graduationYear: new Date().getFullYear() + 4,
    graduationTerm: 'Spring',
    completedCourses: [] as string[],
    gpa: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let year = current - 5; year <= current + 5; year += 1) {
      years.push(year);
    }
    return years;
  }, []);

  useEffect(() => {
    fetchMajors()
      .then(setMajorOptions)
      .catch((error) => console.error('Failed to load majors:', error));
  }, []);

  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    if (step === 2) {
      if (!formData.majorId) {
        newErrors.majorId = 'Please select a major';
      }
    }

    if (step === 3) {
      if (!formData.graduationTerm || !formData.graduationYear) {
        newErrors.targetGraduation = 'Please select a target graduation term';
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast({
        title: "Please complete required fields",
        description: "Fill in all required fields to continue.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleComplete = () => {
    const targetGraduation = `${formData.graduationTerm} ${formData.graduationYear}`;
    completeOnboarding({
      majorId: formData.majorId,
      admittedYear: formData.startYear,
      startTerm: formData.startTerm.toLowerCase() as 'fall' | 'spring',
      graduationYear: formData.graduationYear,
      targetGraduation,
      completedCourses: formData.completedCourses,
    });

    if (accessToken) {
      void updateProfile(accessToken, {
        email: user?.email ?? undefined,
        major_code: formData.majorId,
        graduation_year: formData.graduationYear,
        graduation_term: formData.graduationTerm,
        start_year: formData.startYear,
        start_term: formData.startTerm,
        completed_courses: formData.completedCourses,
        gpa: formData.gpa ? Number(formData.gpa) : undefined,
      });
    }

    toast({
      title: "Plan generated!",
      description: "Your personalized 4-year plan is ready.",
    });
    navigate('/dashboard');
  };

  const toggleCourse = (courseId: string) => {
    setFormData(prev => ({
      ...prev,
      completedCourses: prev.completedCourses.includes(courseId)
        ? prev.completedCourses.filter(id => id !== courseId)
        : [...prev.completedCourses, courseId],
    }));
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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep > step.id
                  ? 'bg-accent text-accent-foreground'
                  : currentStep === step.id
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'bg-primary-foreground/10'
              }`}>
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
            <span className="text-sm font-medium text-foreground">Step {currentStep} of {steps.length}</span>
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
                      We'll help you map out your courses, track prerequisites, and stay on track for graduation.
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
                          setFormData(prev => ({ ...prev, majorId: value }));
                          setErrors(prev => ({ ...prev, majorId: undefined }));
                          const subject = value === 'UNDECLARED' ? null : value;
                          void loadCourses(subject);
                        }}
                      >
                        <SelectTrigger className={errors.majorId ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Select your major" />
                        </SelectTrigger>
                        <SelectContent>
                          {majorOptions.map(option => (
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
                        onValueChange={(value) => setFormData(prev => ({ ...prev, startYear: parseInt(value, 10) }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map(year => (
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
                        onValueChange={(value) => {
                          setFormData(prev => ({ ...prev, startTerm: value }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select term" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fall">Fall</SelectItem>
                          <SelectItem value="Spring">Spring</SelectItem>
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
                            setFormData(prev => ({ ...prev, graduationTerm: value }));
                            setErrors(prev => ({ ...prev, targetGraduation: undefined }));
                          }}
                        >
                          <SelectTrigger className={errors.targetGraduation ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Term" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Spring">Spring</SelectItem>
                            <SelectItem value="Fall">Fall</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={formData.graduationYear.toString()}
                          onValueChange={(value) => {
                            setFormData(prev => ({ ...prev, graduationYear: parseInt(value, 10) }));
                            setErrors(prev => ({ ...prev, targetGraduation: undefined }));
                          }}
                        >
                          <SelectTrigger className={errors.targetGraduation ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map(year => (
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
                      <Label>Search courses</Label>
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search by code or keyword"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {formData.completedCourses.length > 0 ? (
                        formData.completedCourses.map(courseId => {
                          const course = availableCourses.find(c => c.id === courseId);
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
                        .filter(course => {
                          const search = searchTerm.trim().toLowerCase();
                          if (!search) return true;
                          return (
                            course.code.toLowerCase().includes(search) ||
                            course.title.toLowerCase().includes(search) ||
                            (course.description ?? '').toLowerCase().includes(search)
                          );
                        })
                        .slice(0, 12)
                        .map(course => (
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
                            <span className="text-sm text-muted-foreground">{course.credits} cr</span>
                            {formData.completedCourses.includes(course.id) && (
                              <CheckCircle2 className="w-5 h-5 text-accent" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Click to select/deselect. You can also import from CSV later.
                    </p>
                    <div className="mt-4 space-y-2">
                      <Label>Current GPA (optional)</Label>
                      <input
                        value={formData.gpa}
                        onChange={(event) => setFormData(prev => ({ ...prev, gpa: event.target.value }))}
                        placeholder="3.5"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
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
                          {majorOptions.find(option => option.code === formData.majorId)?.name || formData.majorId}
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
                        <span className="font-medium text-foreground">{formData.completedCourses.length}</span>
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
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            
            {currentStep < 5 ? (
              <Button onClick={handleNext} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                Generate Plan
                <Sparkles className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
