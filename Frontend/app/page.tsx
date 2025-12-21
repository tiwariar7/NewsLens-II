// app/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { Logo } from "@/components/shared/Logo";
import { Loader2 } from "lucide-react"; // nice subtle spinner icon

export default function RootPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [token, router]);

  // Minimal full-screen loading state
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <Logo />
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Redirecting...</span>
      </div>
    </div>
  );
}
