import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <p className="text-muted-foreground">Failed to load your profile.</p>
        <button
          onClick={onRetry}
          className="text-primary underline text-sm hover:opacity-80"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

// Guards /dashboard, /planner, /courses, /calendar, /profile
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { profileStatus, retry } = useProfile();

  if (!user) return <Navigate to="/login" replace />;
  if (profileStatus === 'loading') return <LoadingScreen />;
  if (profileStatus === 'error') return <ErrorScreen onRetry={retry} />;
  if (profileStatus === 'incomplete') return <Navigate to="/onboard" replace />;

  return <>{children}</>;
}

// Guards /onboard — blocks access once onboarding is complete
export function OnboardRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { profileStatus, retry } = useProfile();

  if (!user) return <Navigate to="/login" replace />;
  if (profileStatus === 'loading') return <LoadingScreen />;
  if (profileStatus === 'error') return <ErrorScreen onRetry={retry} />;
  if (profileStatus === 'complete') return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
