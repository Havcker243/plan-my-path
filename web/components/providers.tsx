"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { PlanProvider } from "@/contexts/plan-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PlanProvider>{children}</PlanProvider>
    </AuthProvider>
  );
}
