"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  const handleResend = async () => {
    if (!email) {
      setError("Email not found. Please sign up again.");
      return;
    }
    setResending(true);
    setError("");
    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResending(false);
    if (authError) {
      setError(authError.message ?? "Failed to resend email");
      return;
    }
    setResent(true);
  };

  const handleContinue = () => {
    router.push("/onboarding");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-xl">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-lg tracking-tight">FiskGrad</span>
        </div>

        {/* Email icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a verification link{email ? <> to <span className="font-medium text-foreground">{email}</span></> : " to your email address"}. Click the link to verify your account and get started.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <div className="pt-2 space-y-3">
          <Button onClick={handleContinue} className="w-full h-11">
            Continue to Setup
          </Button>

          <Button
            variant="outline"
            onClick={handleResend}
            disabled={resending}
            className="w-full h-11 gap-2"
          >
            {resending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Resending...
              </>
            ) : resent ? (
              "Email resent!"
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Resend email
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Wrong email?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Go back
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
