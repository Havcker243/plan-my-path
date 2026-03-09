import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { fetchProfile, type ProfilePayload } from '@/lib/api';

export type ProfileStatus = 'loading' | 'incomplete' | 'complete' | 'error';

interface ProfileContextValue {
  profileStatus: ProfileStatus;
  profile: ProfilePayload | null;
  markComplete: (profile: ProfilePayload) => void;
  retry: () => void;
  resetProfile: () => void;
}

// ─── localStorage draft helpers (exported for Onboarding) ────────────────────

const draftKey = (userId: string) => `onboarding_draft_${userId}`;

export function saveDraft(userId: string, data: unknown): void {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(data));
  } catch {
    // localStorage unavailable — ignore
  }
}

export function loadDraft<T = unknown>(userId: string): T | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string): void {
  try {
    localStorage.removeItem(draftKey(userId));
  } catch {
    // ignore
  }
}

// ─── Profile completeness check ───────────────────────────────────────────────

function isProfileComplete(profile: ProfilePayload | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.major_code &&
      profile.start_year &&
      profile.start_term &&
      profile.graduation_year
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const { hydrateProfile, resetPlan } = usePlanner();

  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading');
  const [profile, setProfile] = useState<ProfilePayload | null>(null);

  // Tracks which userId we've already fetched for — prevents re-fetching on
  // every navigation or token refresh within the same session.
  const fetchedForUser = useRef<string | null>(null);

  const doFetch = useCallback(
    async (token: string) => {
      setProfileStatus('loading');
      try {
        const fetched = await fetchProfile(token);
        setProfile(fetched);
        if (isProfileComplete(fetched)) {
          hydrateProfile(fetched!);
          setProfileStatus('complete');
        } else {
          setProfileStatus('incomplete');
        }
      } catch {
        setProfileStatus('error');
      }
    },
    [hydrateProfile]
  );

  useEffect(() => {
    if (!user) {
      // User logged out — clear everything
      if (fetchedForUser.current) {
        resetPlan();
      }
      fetchedForUser.current = null;
      setProfileStatus('loading');
      setProfile(null);
      return;
    }

    // Already fetched for this user this session — don't re-fetch
    if (!accessToken || fetchedForUser.current === user.id) return;

    fetchedForUser.current = user.id;
    doFetch(accessToken);
  }, [user, accessToken, doFetch, resetPlan]);

  // Called by Onboarding after both saves are confirmed by the backend
  const markComplete = useCallback(
    (savedProfile: ProfilePayload) => {
      setProfile(savedProfile);
      hydrateProfile(savedProfile);
      setProfileStatus('complete');
    },
    [hydrateProfile]
  );

  // Called from the error UI — lets the user retry a failed fetch
  const retry = useCallback(() => {
    if (!accessToken) return;
    fetchedForUser.current = null;
    doFetch(accessToken).then(() => {
      if (user?.id) fetchedForUser.current = user.id;
    });
  }, [accessToken, doFetch, user?.id]);

  // Called by the "Reset Plan" action — resets local profile status so the
  // user can go through onboarding again. The ProtectedRoute will redirect
  // them to /onboard automatically once profileStatus becomes 'incomplete'.
  const resetProfile = useCallback(() => {
    // Do NOT clear fetchedForUser — if we did, the useEffect would immediately
    // re-fetch the profile from the backend (which is still complete) and flip
    // profileStatus back to 'complete', making the reset a no-op.
    // The user must complete onboarding again this session to get back to 'complete'.
    setProfile(null);
    setProfileStatus('incomplete');
    resetPlan();
  }, [resetPlan]);

  return (
    <ProfileContext.Provider value={{ profileStatus, profile, markComplete, retry, resetProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
