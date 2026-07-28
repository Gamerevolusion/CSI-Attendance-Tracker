"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Route guard that allows Admin OR Head's Access.
 * Blocks Member's Access with an "Access Denied" screen.
 */
export function HeadRoute({ children }: { children: ReactNode }) {
  const { user, accessLevel, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (accessLevel === "Member's Access") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            This page is restricted to team heads and administrators.
            Contact your team lead for access.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-2 text-sm text-primary underline hover:no-underline"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
