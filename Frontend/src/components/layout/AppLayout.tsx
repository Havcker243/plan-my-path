import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  LayoutDashboard,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  User,
  LogOut,
  FileText,
  BookOpen,
  RotateCcw,
  Save,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { usePlanner } from '@/contexts/PlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { exportToICS } from '@/utils/icsExport';

interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: FileText, label: 'Planner', path: '/planner' },
  { icon: BookOpen, label: 'Courses', path: '/courses' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
];

const quickActions = [
  { icon: Save, label: 'Save Plan', action: 'save' },
  { icon: RotateCcw, label: 'Reset', action: 'reset' },
];

export function AppLayout({ children, showSidebar = true }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { savePlan, semesters, studentProfile } = usePlanner();
  const { signOut, user } = useAuth();
  const { resetProfile } = useProfile();

  const notifications = useMemo(() => {
    const items: { type: 'warning' | 'info'; message: string }[] = [];
    semesters.forEach((s) => {
      const credits = s.courses.reduce((sum, c) => sum + c.credits, 0);
      if (credits > 18) {
        items.push({ type: 'warning', message: `${s.label} — heavy load: ${credits} credits` });
      }
    });
    if (!studentProfile?.targetGraduation) {
      items.push({ type: 'info', message: 'No graduation target set — add one in Profile' });
    }
    const allCourses = semesters.flatMap((s) => s.courses);
    if (allCourses.length > 0 && allCourses.every((c) => c.status !== 'completed')) {
      items.push({ type: 'info', message: 'No courses marked as completed yet' });
    }
    return items;
  }, [semesters, studentProfile]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'reset':
        if (confirm('Are you sure you want to reset your plan? This will restart onboarding.')) {
          resetProfile();
          // ProtectedRoute will redirect to /onboard automatically
          // once profileStatus becomes 'incomplete'
        }
        break;
      case 'save':
        void savePlan();
        break;
    }
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/courses?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      // ProfileContext clears plan state when user becomes null (via its own useEffect)
      navigate('/');
    }
  };

  // Build avatar initials from profile name or user metadata
  const rawName =
    studentProfile?.name ??
    (user?.user_metadata as { name?: string } | undefined)?.name ??
    user?.email ??
    '';
  const initials = rawName
    .split(' ')
    .map((part) => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('') || 'ME';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      {showSidebar && (
        <motion.aside
          initial={false}
          animate={{ width: sidebarCollapsed ? 64 : 240 }}
          className="bg-sidebar border-r border-sidebar-border flex flex-col shrink-0"
        >
          {/* Logo */}
          <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-semibold text-sidebar-foreground whitespace-nowrap overflow-hidden"
                  >
                    4-Year Planner
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}

            {/* Quick Actions */}
            <div className="pt-4 border-t border-sidebar-border mt-4">
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 py-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider"
                  >
                    Quick Actions
                  </motion.p>
                )}
              </AnimatePresence>
              {quickActions.map((action) => (
                <button
                  key={action.action}
                  onClick={() => handleQuickAction(action.action)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                >
                  <action.icon className="w-5 h-5 shrink-0" />
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="whitespace-nowrap"
                      >
                        {action.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </div>
          </nav>

          {/* Collapse toggle */}
          <div className="p-3 border-t border-sidebar-border">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm">Collapse</span>
                </>
              )}
            </button>
          </div>
        </motion.aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
          {/* Search — press Enter to go to /courses?q=... */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search courses… (Enter)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchSubmit}
                className="pl-10 bg-muted/50 border-transparent focus:bg-background focus:border-input"
              />
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Notifications bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">
                    Notifications
                    {notifications.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({notifications.length})
                      </span>
                    )}
                  </p>
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    All clear — your plan looks good!
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map((n, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0"
                      >
                        {n.type === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm text-foreground">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              className="gap-2 text-muted-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-accent text-accent-foreground text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    exportToICS(semesters);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export .ics
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto custom-scrollbar">{children}</main>
      </div>
    </div>
  );
}
