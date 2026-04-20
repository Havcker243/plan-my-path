"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const finishAuth = async () => {
      const supabase = getSupabase();
      const next = searchParams.get("next") || "/onboarding";
      const code = searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) setError(exchangeError.message);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setError("We could not finish signing you in. Please return to the sign-in page.");
        return;
      }

      router.replace(next);
    };

    finishAuth();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-xl">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-lg tracking-tight">FiskGrad</span>
        </div>

        {error ? (
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">Verification link problem</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Finishing verification</h1>
            <p className="text-sm text-muted-foreground">Please wait while FiskGrad opens your account.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackContent />
    </Suspense>
  );
}
