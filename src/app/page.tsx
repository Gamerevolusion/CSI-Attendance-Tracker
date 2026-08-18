"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/lib/hooks/useDashboard";
import { getTodayIST, formatDateDisplay, dateToISTString } from "@/lib/date-utils";
import type { Team } from "@/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  CheckCircle2,
  XCircle,
  BarChart3,
  Calendar as CalendarIconLucide,
  Users,
  CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function DashboardContent() {
  const { user, accessLevel, teamId: userTeamId } = useAuth();

  // Dashboard filter mode: 'date' for single date-wise, 'range' for month/custom range
  const [filterMode, setFilterMode] = useState<"date" | "range">("date");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateOpen, setDateOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // Use the optimized hook for data fetching
  const {
    teams,
    selectedTeam,
    members,
    todayRecords,
    filteredRecords,
    loading,
    dataLoading,
    totalMembers,
    todayMarked,
    todayCount,
    attendanceSummary,
    maxSessions,
  } = useDashboardData({
    accessLevel,
    userTeamId,
    user,
    filterMode,
    selectedDate,
    dateFrom,
    dateTo,
  });

  const today = getTodayIST();
  const currentTeam = teams.find((t) => t.id === selectedTeam);
  const selectedDateStr = dateToISTString(selectedDate);
  const fromStr = dateToISTString(dateFrom);
  const toStr = dateToISTString(dateTo);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {formatDateDisplay(today)} · Committee Overview
          </p>
        </div>
        {accessLevel !== "Member's Access" && (
          <Link href="/attendance/mark">
            <Button className="w-full sm:w-auto">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Mark Attendance
            </Button>
          </Link>
        )}
      </div>

      {/* Team Tabs — hidden for Head/Member (locked to their team) */}
      {accessLevel === "Admin" && (
        <Tabs value={selectedTeam} onValueChange={(val) => { /* Team selection handled by hook */ }}>
          <div className="neo-scroll-x -mx-4 px-4">
            <TabsList className="inline-flex w-max">
              {teams.map((team) => (
                <TabsTrigger key={team.id} value={team.id} className="text-xs sm:text-sm whitespace-nowrap">
                  {team.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      )}

      {/* Filter Mode & Date Selection Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <Tabs value={filterMode} onValueChange={(val) => setFilterMode(val as "date" | "range")} className="w-auto">
            <TabsList className="h-8">
              <TabsTrigger value="date" className="text-xs px-3 h-6">By Date</TabsTrigger>
              <TabsTrigger value="range" className="text-xs px-3 h-6">Range</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterMode === "date" ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground font-medium shrink-0">Date:</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background px-2.5 h-9 sm:h-8 text-xs font-medium hover:bg-muted flex-1 sm:w-36 sm:flex-initial justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  {format(selectedDate, "dd MMM yyyy")}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => { if (d) { setSelectedDate(d); setDateOpen(false); } }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground font-medium shrink-0">From:</Label>
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background px-2.5 h-9 sm:h-8 text-xs font-medium hover:bg-muted flex-1 sm:w-36 sm:flex-initial justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  {format(dateFrom, "dd MMM yyyy")}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => { if (d) { setDateFrom(d); setFromOpen(false); } }}
                  />
                </PopoverContent>
              </Popover>

              <Label className="text-xs text-muted-foreground font-medium shrink-0">To:</Label>
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background px-2.5 h-9 sm:h-8 text-xs font-medium hover:bg-muted flex-1 sm:w-36 sm:flex-initial justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  {format(dateTo, "dd MMM yyyy")}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => { if (d) { setDateTo(d); setToOpen(false); } }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

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
                  Today&apos;s Status ({format(new Date(), "dd MMM")})
                </CardTitle>
                {todayMarked ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 animate-halo-glow" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground/30" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {todayMarked ? "Marked" : "Not Marked"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {todayCount} of {totalMembers} members recorded today
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
                  {filterMode === "date" ? "Selected Date Status" : "Range Sessions"}
                </CardTitle>
                <CalendarIconLucide className="h-5 w-5 text-muted-foreground/50" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filterMode === "date"
                    ? attendanceSummary.some((m) => m.recorded)
                      ? "Recorded"
                      : "No Data"
                    : `${maxSessions}`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {filterMode === "date"
                    ? `For ${formatDateDisplay(selectedDateStr)}`
                    : "Days recorded in selected range"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Overview Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {filterMode === "date"
                  ? `${formatDateDisplay(selectedDateStr)} — Lectures Missed`
                  : `${formatDateDisplay(fromStr)} to ${formatDateDisplay(toStr)} — Lectures Missed`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceSummary.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No active members in this team
                </div>
              ) : !attendanceSummary.some((m) => m.recorded) ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No attendance records found for the selected {filterMode === "date" ? "date" : "range"}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Year / Dept</TableHead>
                        <TableHead className="text-center">
                          {filterMode === "date" ? "Missed Lectures" : "Total Missed"}
                        </TableHead>
                        <TableHead className="text-center">
                          {filterMode === "date" ? "Status" : "Sessions Recorded"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceSummary.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {row.year} · {row.department}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                row.totalMissed === 0
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : row.totalMissed >= 4
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}
                            >
                              {row.totalMissed}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {filterMode === "date" ? (
                              row.recorded ? (
                                row.totalMissed === 0 ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800 text-xs">Present</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 text-xs">Partially Absent</Badge>
                                )
                              ) : (
                                <Badge variant="secondary" className="text-xs">Not Recorded</Badge>
                              )
                            ) : (
                              row.sessions
                            )}
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