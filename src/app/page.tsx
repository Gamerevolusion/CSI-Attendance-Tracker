"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getTeams, getTeamMembers } from "@/lib/actions/roster";
import { getAttendanceByTeamAndDate, getAttendanceByTeamAndDateRange } from "@/lib/actions/attendance";
import { getTodayIST, getMonthStartIST, getMonthEndIST, getCurrentMonthYear, formatDateDisplay } from "@/lib/date-utils";
import type { Team, Member, AttendanceRecord } from "@/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardCheck,
  ArrowRight,
  CheckCircle2,
  XCircle,
  BarChart3,
  Calendar,
  Users,
} from "lucide-react";
import { toast } from "sonner";

function DashboardContent() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Dashboard data
  const [todayMarked, setTodayMarked] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [monthlyData, setMonthlyData] = useState<
    { name: string; totalMissed: number; sessions: number }[]
  >([]);

  const today = getTodayIST();
  const monthStart = getMonthStartIST();
  const monthEnd = getMonthEndIST();

  // Load teams
  useEffect(() => {
    async function load() {
      try {
        const t = await getTeams();
        setTeams(t);
        if (t.length > 0) setSelectedTeam(t[0].id);
      } catch {
        toast.error("Failed to load teams");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load dashboard data when team changes
  useEffect(() => {
    if (!selectedTeam) return;

    async function loadData() {
      setDataLoading(true);
      try {
        const [members, todayRecords, monthRecords] = await Promise.all([
          getTeamMembers(selectedTeam),
          getAttendanceByTeamAndDate(selectedTeam, today),
          getAttendanceByTeamAndDateRange(selectedTeam, monthStart, monthEnd),
        ]);

        setTotalMembers(members.length);
        setTodayMarked(todayRecords.length > 0);
        setTodayCount(todayRecords.length);

        // Compute monthly summary per member
        const memberMap = new Map<
          string,
          { name: string; totalMissed: number; dates: Set<string> }
        >();

        // Initialize with all active members
        for (const m of members) {
          memberMap.set(m.id, { name: m.name, totalMissed: 0, dates: new Set() });
        }

        // Aggregate attendance data
        for (const record of monthRecords) {
          const entry = memberMap.get(record.memberId);
          if (entry) {
            entry.totalMissed += record.totalMissed;
            entry.dates.add(record.date);
          }
        }

        const summary = Array.from(memberMap.values())
          .map((entry) => ({
            name: entry.name,
            totalMissed: entry.totalMissed,
            sessions: entry.dates.size,
          }))
          .sort((a, b) => b.totalMissed - a.totalMissed);

        setMonthlyData(summary);
      } catch {
        toast.error("Failed to load dashboard data");
      } finally {
        setDataLoading(false);
      }
    }

    loadData();
  }, [selectedTeam, today, monthStart, monthEnd]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const currentTeam = teams.find((t) => t.id === selectedTeam);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateDisplay(today)} · {getCurrentMonthYear()} overview
          </p>
        </div>
        <Link href="/attendance/mark">
          <Button>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Mark Attendance
          </Button>
        </Link>
      </div>

      {/* Team Tabs */}
      <Tabs value={selectedTeam} onValueChange={setSelectedTeam}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="inline-flex w-max">
            {teams.map((team) => (
              <TabsTrigger key={team.id} value={team.id} className="text-xs sm:text-sm whitespace-nowrap">
                {team.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {dataLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today's Status
                </CardTitle>
                {todayMarked ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground/30" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {todayMarked ? "Marked" : "Not Marked"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {todayCount} of {totalMembers} members recorded
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Team Members
                </CardTitle>
                <Users className="h-5 w-5 text-muted-foreground/50" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalMembers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active members in {currentTeam?.name}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Monthly Sessions
                </CardTitle>
                <Calendar className="h-5 w-5 text-muted-foreground/50" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(
                    monthlyData.flatMap((d) =>
                      d.sessions > 0 ? [d.sessions] : []
                    )
                  ).size > 0
                    ? Math.max(...monthlyData.map((d) => d.sessions))
                    : 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Days recorded this month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Overview Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {getCurrentMonthYear()} — Lectures Missed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No attendance data this month
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead className="text-center">
                          Total Missed
                        </TableHead>
                        <TableHead className="text-center">
                          Sessions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyData.map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                row.totalMissed === 0
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : row.totalMissed >= 10
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}
                            >
                              {row.totalMissed}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {row.sessions}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
