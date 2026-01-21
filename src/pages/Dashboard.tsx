import { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  BookOpen, 
  TrendingUp, 
  Calendar, 
  Plus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { usePlanner } from '@/contexts/PlannerContext';
import { AppLayout } from '@/components/layout/AppLayout';

export function Dashboard() {
  const navigate = useNavigate();
  const { 
    semesters, 
    studentProfile, 
    totalCredits, 
    earnedCredits, 
    currentGPA,
    isOnboarded 
  } = usePlanner();

  // Redirect to onboarding if not onboarded
  useEffect(() => {
    if (!isOnboarded) {
      navigate('/onboard');
    }
  }, [isOnboarded, navigate]);

  if (!isOnboarded) {
    return null;
  }

  const progressPercent = useMemo(() => {
    return totalCredits > 0 ? Math.round((earnedCredits / totalCredits) * 100) : 0;
  }, [earnedCredits, totalCredits]);

  const plannedCredits = useMemo(() => {
    return semesters
      .flatMap(s => s.courses)
      .filter(c => c.status === 'planned')
      .reduce((sum, c) => sum + c.credits, 0);
  }, [semesters]);

  const upcomingSemester = useMemo(() => {
    return semesters.find(s => s.courses.some(c => c.status === 'planned'));
  }, [semesters]);

  const warnings = useMemo(() => {
    const issues: string[] = [];
    semesters.forEach(semester => {
      const semesterCredits = semester.courses.reduce((sum, c) => sum + c.credits, 0);
      if (semesterCredits > semester.maxCredits) {
        issues.push(`${semester.label} exceeds ${semester.maxCredits} credit limit`);
      }
    });
    return issues;
  }, [semesters]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back{studentProfile?.name ? `, ${studentProfile.name}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your academic progress.
          </p>
        </motion.div>

        {/* Main Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-border shadow-sm card-hover">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Credits Progress
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-3xl font-bold text-foreground">{earnedCredits}</span>
                  <span className="text-muted-foreground mb-1">/ {totalCredits}</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">{progressPercent}% complete</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-border shadow-sm card-hover">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Current GPA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-foreground">
                    {currentGPA.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground mb-1">/ 4.00</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Based on {earnedCredits > 0 ? `${Math.floor(earnedCredits / 3)} courses` : 'no courses yet'}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-border shadow-sm card-hover">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Target Graduation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {studentProfile?.targetGraduation || 'Spring 2028'}
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  {plannedCredits} credits planned
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-border shadow-sm card-hover">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Major
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-foreground">Computer Science</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Catalog {studentProfile?.catalogYear || '2024-2025'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2"
          >
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-auto py-4 justify-start gap-3 border-border hover:bg-accent/10 hover:border-accent"
                  onClick={() => navigate('/planner')}
                >
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">Open Planner</p>
                    <p className="text-xs text-muted-foreground">View & edit your 4-year plan</p>
                  </div>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 justify-start gap-3 border-border hover:bg-accent/10 hover:border-accent"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">Add Courses</p>
                    <p className="text-xs text-muted-foreground">Import or add completed courses</p>
                  </div>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {warnings.length > 0 ? (
                  warnings.map((warning, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground">{warning}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex items-start gap-3 p-3 bg-success/10 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">Your plan is on track!</p>
                  </div>
                )}
                
                {upcomingSemester && (
                  <div className="flex items-start gap-3 p-3 bg-accent/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Next: {upcomingSemester.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {upcomingSemester.courses.length} courses planned
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Upcoming Semester Preview */}
        {upcomingSemester && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-6"
          >
            <Card className="border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Upcoming: {upcomingSemester.label}</CardTitle>
                  <CardDescription>
                    {upcomingSemester.courses.reduce((sum, c) => sum + c.credits, 0)} credits planned
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => navigate('/planner')}>
                  View Full Plan
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {upcomingSemester.courses.map(course => (
                    <Badge
                      key={course.id}
                      variant="secondary"
                      className={`py-2 px-3 ${
                        course.type === 'core' ? 'bg-primary/10 text-primary border-primary/20' :
                        course.type === 'elective' ? 'bg-accent/10 text-accent border-accent/20' :
                        'bg-muted'
                      }`}
                    >
                      <span className="font-medium">{course.code}</span>
                      <span className="mx-2 opacity-50">•</span>
                      <span>{course.credits} cr</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
