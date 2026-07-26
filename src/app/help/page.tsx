"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ClipboardCheck,
  LayoutDashboard,
  FileText,
  Users,
  BookOpen,
  UserCog,
  History,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Calendar,
  Sparkles,
  ArrowRight,
  Download,
  Info,
  Layers,
  ChevronDown,
  ChevronRight,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function HelpContent() {
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const sections = [
    { id: "overview", label: "System Overview", icon: ShieldCheck },
    { id: "dashboard", label: "Dashboard Analytics", icon: LayoutDashboard },
    { id: "marking", label: "Per-Subject Marking", icon: ClipboardCheck },
    { id: "reports", label: "PDF Reports Generator", icon: FileText },
    { id: "roster", label: "Roster Management", icon: Users },
    { id: "curriculum", label: "Curriculum Setup", icon: BookOpen },
    { id: "history", label: "Attendance History", icon: History },
    { id: "users", label: "User Access Control", icon: UserCog },
  ];

  const faqs = [
    {
      question: "How does the per-subject attendance tracking work?",
      answer:
        "Curriculums are configured per Year (FY, SY, TY) and Department (CS, IT, DS). When marking attendance for a team member, the system displays their exact subjects (Lectures & Practicals). Members can be marked Present, Missed (with lecture count 0–4), or No Class.",
    },
    {
      question: "Who can access and mark attendance in the portal?",
      answer:
        "Only Google accounts authorized in the 'Manage Users' section can sign in. Authorized users can mark attendance and view reports. Only Admin users can edit team rosters, manage curriculums, and alter authorized user permissions.",
    },
    {
      question: "Can exported PDF reports be presented to college faculty?",
      answer:
        "Yes! The PDF generator compiles per-subject missed lecture breakdowns, member roles, academic year, and department data into a clean, faculty-ready document complete with official CSI chapter branding and date range summaries.",
    },
    {
      question: "What happens when a member is deactivated or deleted?",
      answer:
        "Deactivating a member retains their records while hiding them from active daily marking grids. Deleting a member permanently removes them and cleans up their historical attendance records across all system views.",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header Banner */}
      <div className="neo-card animate-neo-pop p-6 sm:p-8 rounded-2xl relative overflow-hidden border-0">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full neo-pressed text-xs font-semibold">
              <Image
                src="/csi.png"
                alt="CSI"
                width={20}
                height={20}
                className="h-4 w-4 object-contain"
              />
              <span className="text-emerald-600 font-bold">CSI STUDENT CHAPTER</span>
              <span className="opacity-40">•</span>
              <span style={{ color: "var(--neo-text-muted)" }}>SYSTEM USER GUIDE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight">
              Attendance Tracker User Guide & Documentation
            </h1>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--neo-text-muted)" }}>
              Comprehensive operational guide detailing system capabilities, per-subject attendance workflows, committee roster management, and official faculty PDF exports.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <Link href="/attendance/mark">
              <Button className="w-full neo-btn gap-2 justify-center">
                <ClipboardCheck className="h-4 w-4" />
                Go to Attendance Grid
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="outline" className="w-full gap-2 justify-center">
                <FileText className="h-4 w-4" />
                Generate Reports
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Quick Bar */}
      <div className="neo-scroll-x -mx-3 px-3">
        <div className="flex gap-2 min-w-max pb-2">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setActiveSection(sec.id);
                  const el = document.getElementById(`help-${sec.id}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  active ? "neo-raised font-bold" : "opacity-75 hover:opacity-100"
                }`}
                style={{
                  color: active ? "var(--neo-text)" : "var(--neo-text-muted)",
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {sec.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. System Overview Section */}
      <section id="help-overview" className="space-y-4 animate-fade-up delay-100">
        <div className="flex items-center gap-2">
          <div className="neo-raised flex h-8 w-8 items-center justify-center rounded-lg">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold font-heading">1. System Architecture & Security</h2>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="neo-pressed p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                  <Lock className="h-4 w-4" />
                  Authorized Google SSO
                </div>
                <p className="text-xs" style={{ color: "var(--neo-text-muted)" }}>
                  Domain-secured sign in restricting portal access strictly to designated committee members and faculty leads.
                </p>
              </div>

              <div className="neo-pressed p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                  <Layers className="h-4 w-4" />
                  Per-Subject Multi-Team
                </div>
                <p className="text-xs" style={{ color: "var(--neo-text-muted)" }}>
                  Independent tracking across Technical, Design, Operations, and Management teams with subject granularity.
                </p>
              </div>

              <div className="neo-pressed p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm">
                  <Sparkles className="h-4 w-4" />
                  Real-time Cloud Sync
                </div>
                <p className="text-xs" style={{ color: "var(--neo-text-muted)" }}>
                  Powered by Firebase Firestore database providing instant synchronization and data integrity.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. Per-Subject Attendance Marking */}
      <section id="help-marking" className="space-y-4 animate-fade-up delay-200">
        <div className="flex items-center gap-2">
          <div className="neo-raised flex h-8 w-8 items-center justify-center rounded-lg">
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold font-heading">2. Per-Subject Attendance Marking Workflow</h2>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-6 space-y-4">
                <p className="text-sm leading-relaxed" style={{ color: "var(--neo-text-muted)" }}>
                  The Mark Attendance page allows committee leads to record daily attendance per subject for all active members in a team.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="neo-raised flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0">1</span>
                    <div className="text-xs">
                      <strong className="block text-foreground">Select Team & Date Range</strong>
                      Choose the target team tab (e.g. Technical) and set the date range.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="neo-raised flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0">2</span>
                    <div className="text-xs">
                      <strong className="block text-foreground">1-Tap Cell Cycling</strong>
                      Click any grid cell to cycle between:
                      <span className="inline-flex items-center gap-1.5 ml-1 font-semibold text-emerald-600">Present</span> ·
                      <span className="inline-flex items-center gap-1.5 ml-1 font-semibold text-red-600">Missed</span> ·
                      <span className="inline-flex items-center gap-1.5 ml-1 font-semibold text-muted-foreground">No Class</span>.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="neo-raised flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0">3</span>
                    <div className="text-xs">
                      <strong className="block text-foreground">Adjust Missed Count & Add Notes</strong>
                      Use the <code className="px-1 bg-muted rounded">+</code> / <code className="px-1 bg-muted rounded">−</code> buttons to set exact missed lecture counts per subject and attach notes.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="neo-raised flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0">4</span>
                    <div className="text-xs">
                      <strong className="block text-foreground">Batched Save to Cloud</strong>
                      Click the glowing <strong className="text-emerald-600">Save</strong> button to commit all team changes in a single cloud batch.
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Mock Preview */}
              <div className="lg:col-span-6 neo-pressed p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-bold">Attendance Grid Preview</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">Live Grid</Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="neo-raised p-2.5 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold">Rahul Sharma</span>
                      <span className="text-[10px] text-muted-foreground ml-2">TY · CS</span>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="neo-cell neo-cell-present text-[10px] font-bold">P</div>
                      <div className="neo-cell neo-cell-missed text-[10px] font-bold">M (1)</div>
                      <div className="neo-cell neo-cell-noclass text-[10px] font-bold">—</div>
                    </div>
                  </div>

                  <div className="neo-raised p-2.5 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold">Priya Patel</span>
                      <span className="text-[10px] text-muted-foreground ml-2">SY · IT</span>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="neo-cell neo-cell-present text-[10px] font-bold">P</div>
                      <div className="neo-cell neo-cell-present text-[10px] font-bold">P</div>
                      <div className="neo-cell neo-cell-present text-[10px] font-bold">P</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Dashboard Analytics */}
      <section id="help-dashboard" className="space-y-4 animate-fade-up delay-300">
        <div className="flex items-center gap-2">
          <div className="neo-raised flex h-8 w-8 items-center justify-center rounded-lg">
            <LayoutDashboard className="h-4 w-4 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold font-heading">3. Executive Dashboard & Real-Time Analytics</h2>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: "var(--neo-text-muted)" }}>
              The Dashboard gives faculty and committee admins an instant overview of committee attendance for today or over any date/month range.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="neo-raised p-4 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Today&apos;s Status</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 animate-halo-glow" />
                </div>
                <div className="text-lg font-bold text-emerald-600">Marked</div>
                <p className="text-[11px] text-muted-foreground">All active members recorded for today</p>
              </div>

              <div className="neo-raised p-4 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Active Roster</span>
                  <Users className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-lg font-bold">42 Members</div>
                <p className="text-[11px] text-muted-foreground">Across CS, IT, and DS departments</p>
              </div>

              <div className="neo-raised p-4 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Filter Mode</span>
                  <Calendar className="h-4 w-4 text-purple-500" />
                </div>
                <div className="text-lg font-bold">Date & Range</div>
                <p className="text-[11px] text-muted-foreground">Toggle single date or monthly views</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Official PDF Reports Generator */}
      <section id="help-reports" className="space-y-4 animate-fade-up delay-400">
        <div className="flex items-center gap-2">
          <div className="neo-raised flex h-8 w-8 items-center justify-center rounded-lg">
            <FileText className="h-4 w-4 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold font-heading">4. Official PDF Report Exports for Faculty</h2>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-7 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: "var(--neo-text-muted)" }}>
                  Generate per-subject attendance summaries formatted specifically for submission to faculty coordinators and department heads.
                </p>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Includes official CSI Student Chapter PNG Logo header.
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Breaks down theory & practical missed lectures per member.
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Supports multi-team selection or individual team exports.
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Generated 100% client-side instantly with zero server lag.
                  </li>
                </ul>
              </div>

              <div className="md:col-span-5 neo-pressed p-4 rounded-xl text-center space-y-3">
                <div className="flex items-center justify-center gap-2 font-bold text-sm">
                  <Image src="/csi.png" alt="CSI Logo" width={24} height={24} className="h-6 w-6 object-contain" />
                  CSI Official PDF Export
                </div>
                <p className="text-xs text-muted-foreground">
                  Ready to print or submit digitally to college faculty
                </p>
                <Link href="/reports">
                  <Button size="sm" className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Try PDF Export
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 5. Team Roster & Curriculum Setup */}
      <section id="help-roster" className="space-y-4 animate-fade-up delay-500">
        <div className="flex items-center gap-2">
          <div className="neo-raised flex h-8 w-8 items-center justify-center rounded-lg">
            <Users className="h-4 w-4 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold font-heading">5. Team Roster & Curriculum Administration</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                Roster Administration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs" style={{ color: "var(--neo-text-muted)" }}>
              <p>• Add members with specific Year (FY, SY, TY) and Department (CS, IT, DS).</p>
              <p>• Deactivate inactive members without deleting past records.</p>
              <p>• Permanently delete members with automated historical record cleanup.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-purple-600" />
                Curriculum Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs" style={{ color: "var(--neo-text-muted)" }}>
              <p>• Map subjects per Year + Department combination.</p>
              <p>• Assign faculty names and categorize by Lecture vs. Practical.</p>
              <p>• Order subjects logically using vertical arrow controls.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Frequently Asked Questions Accordion */}
      <section className="space-y-4 pt-4">
        <h2 className="text-xl font-bold font-heading flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-blue-600" />
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = expandedFaq === index;
            return (
              <Card
                key={index}
                className="cursor-pointer transition-all duration-200"
                onClick={() => setExpandedFaq(isOpen ? null : index)}
              >
                <CardHeader className="py-4 px-6">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{faq.question}</span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="pt-0 pb-4 px-6 text-xs leading-relaxed" style={{ color: "var(--neo-text-muted)" }}>
                    {faq.answer}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Faculty Presentation Summary Callout */}
      <div className="neo-pressed p-6 rounded-2xl border-l-4 border-l-emerald-500 space-y-2">
        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
          <Info className="h-4 w-4" />
          Summary for Faculty & Department Heads
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--neo-text-muted)" }}>
          The CSI Attendance Tracker replaces paper registers and manual spreadsheet calculations with a centralized cloud portal. It ensures 100% data integrity, automated missed lecture calculations, and instant executive PDF generation.
        </p>
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <ProtectedRoute>
      <HelpContent />
    </ProtectedRoute>
  );
}
