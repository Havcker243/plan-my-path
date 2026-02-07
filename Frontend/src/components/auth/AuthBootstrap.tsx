import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { fetchProfile } from '@/lib/api';

const isProfileComplete = (profile: {
  major_code?: string;
  start_year?: number;
  start_term?: string;
  graduation_year?: number;
} | null) => {
  if (!profile) return false;
  return Boolean(
    profile.major_code &&
      profile.start_year &&
      profile.start_term &&
      profile.graduation_year
  );
};

export function AuthBootstrap() {
  const { user, accessToken } = useAuth();
  const { hydrateProfile, setOnboarded, resetPlan } = usePlanner();
  const location = useLocation();
  const navigate = useNavigate();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      if (lastUserId.current) {
        resetPlan();
      }
      lastUserId.current = null;
      setOnboarded(false);
      return;
    }

    if (!accessToken || lastUserId.current === user.id) return;
    lastUserId.current = user.id;

    fetchProfile(accessToken)
      .then((profile) => {
        if (!profile || !isProfileComplete(profile)) {
          setOnboarded(false);
          if (location.pathname !== '/onboard') {
            navigate('/onboard', { replace: true });
          }
          return;
        }
        hydrateProfile(profile);
        if (['/login', '/signup', '/onboard'].includes(location.pathname)) {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => {
        setOnboarded(false);
      });
  }, [user, accessToken, hydrateProfile, setOnboarded, resetPlan, location.pathname, navigate]);

  return null;
}
