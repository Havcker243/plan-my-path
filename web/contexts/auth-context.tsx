"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { allowedEmailDomainsText, isAllowedSchoolEmail } from "@/lib/email-access";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isAllowedSchoolEmail(email)) {
      return { error: new Error(`Use your Fisk email address (${allowedEmailDomainsText()}).`) };
    }
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!isAllowedSchoolEmail(email)) {
      return { error: new Error(`Use your Fisk email address (${allowedEmailDomainsText()}).`) };
    }
    const supabase = getSupabase();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?next=/onboarding`
            : undefined,
      },
    });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      accessToken: session?.access_token ?? null,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
