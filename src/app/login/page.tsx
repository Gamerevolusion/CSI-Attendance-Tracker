"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";
import {
  ClipboardCheck,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  Users,
  Lock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  const { user, loading, error, signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ background: "var(--neo-bg)" }}
      >
        <div className="neo-raised flex flex-col items-center p-8 rounded-2xl gap-4">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
            style={{
              borderColor: "var(--neo-text) transparent var(--neo-text) var(--neo-text)",
            }}
          />
          <p
            className="text-sm font-medium animate-pulse"
            style={{ color: "var(--neo-text-muted)" }}
          >
            Loading portal...
          </p>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div
      className="relative min-h-dvh w-full overflow-hidden flex items-center justify-center p-4 sm:p-6 lg:p-12"
      style={{ background: "var(--neo-bg)", color: "var(--neo-text)" }}
    >
      {/* Ambient background glow spheres */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full blur-3xl opacity-30 animate-pulse-subtle"
        style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full blur-3xl opacity-30 animate-pulse-subtle"
        style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-5xl">
        {/* Main Grid Card Container with Pop-Up Expand Animation */}
        <div
          className="neo-card animate-neo-pop p-6 sm:p-8 lg:p-12 border-0"
          style={{
            boxShadow:
              "16px 16px 32px var(--neo-shadow-dark), -16px -16px 32px var(--neo-shadow-light)",
            borderRadius: 28,
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Branding & Feature Highlights */}
            <div className="lg:col-span-7 space-y-6">
              {/* Header Badge */}
              <div className="animate-fade-up delay-100 inline-flex items-center gap-2 px-3 py-1.5 rounded-full neo-pressed text-xs font-semibold tracking-wide">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span style={{ color: "var(--neo-text-muted)" }}>
                  CSI STUDENT CHAPTER
                </span>
                <span className="opacity-40">•</span>
                <span className="text-emerald-600 font-bold">ATTENDANCE PORTAL</span>
              </div>

              {/* Main Headline */}
              <div className="animate-fade-up delay-200 space-y-3">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-heading leading-tight">
                  CSI Committee <br className="hidden sm:block" />
                  <span className="bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                    Attendance Management
                  </span>
                </h1>
                <p
                  className="text-xs sm:text-sm leading-relaxed max-w-lg"
                  style={{ color: "var(--neo-text-muted)" }}
                >
                  Per-subject tracking, automated curriculum sync, and instant PDF report exports designed specifically for CSI committee members.
                </p>
              </div>

              {/* Feature Cards Showcase */}
              <div className="animate-fade-up delay-300 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="neo-pressed p-3.5 rounded-xl space-y-1 transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="font-semibold text-xs">Per-Subject Marking</span>
                  </div>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--neo-text-muted)" }}
                  >
                    Theory & Practical lecture status per date
                  </p>
                </div>

                <div className="neo-pressed p-3.5 rounded-xl space-y-1 transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-xs">Instant PDF Reports</span>
                  </div>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--neo-text-muted)" }}
                  >
                    Executive summary & missed lecture stats
                  </p>
                </div>

                <div className="neo-pressed p-3.5 rounded-xl space-y-1 transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600 shrink-0" />
                    <span className="font-semibold text-xs">Multi-Team Roster</span>
                  </div>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--neo-text-muted)" }}
                  >
                    Technical, Design, IT & Management
                  </p>
                </div>

                <div className="neo-pressed p-3.5 rounded-xl space-y-1 transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="font-semibold text-xs">Secure Role Access</span>
                  </div>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--neo-text-muted)" }}
                  >
                    Authorized committee Google sign-in
                  </p>
                </div>
              </div>

              {/* Status footer list */}
              <div className="animate-fade-up delay-400 flex flex-wrap items-center gap-4 pt-2 text-xs opacity-75">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  100% Digital Workflow
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Real-time Cloud Sync
                </span>
              </div>
            </div>

            {/* Right Column: Sign In Card */}
            <div className="lg:col-span-5 animate-fade-up delay-200">
              <div
                className="neo-raised p-6 sm:p-8 rounded-2xl space-y-6 text-center transition-all duration-300 hover:shadow-lg"
                style={{ borderRadius: 24 }}
              >
                {/* Logo Badge */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl neo-raised p-2">
                  <Image
                    src="/csi.png"
                    alt="CSI Logo"
                    width={56}
                    height={56}
                    className="h-12 w-12 object-contain drop-shadow-sm"
                  />
                </div>

                <div>
                  <h2 className="text-xl font-bold font-heading">
                    Welcome Back
                  </h2>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--neo-text-muted)" }}
                  >
                    Sign in with your registered Google account
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600 font-medium text-left">
                    {error}
                  </div>
                )}

                {/* Google Sign In Button */}
                <button
                  onClick={signIn}
                  type="button"
                  className="neo-btn flex w-full items-center justify-center gap-3 px-4 py-3.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ borderRadius: 14 }}
                >
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                  <ArrowRight className="h-4 w-4 opacity-50 ml-auto" />
                </button>

                {/* Security Note */}
                <div
                  className="flex items-center justify-center gap-1.5 text-[11px] pt-1"
                  style={{ color: "var(--neo-text-muted)" }}
                >
                  <Lock className="h-3 w-3 opacity-60 shrink-0" />
                  <span>Authorized committee members only</span>
                </div>
              </div>

              {/* Bottom Copyright */}
              <p
                className="mt-4 text-center text-[11px]"
                style={{ color: "var(--neo-text-muted)", opacity: 0.7 }}
              >
                CSI Committee Attendance Tracker System
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
