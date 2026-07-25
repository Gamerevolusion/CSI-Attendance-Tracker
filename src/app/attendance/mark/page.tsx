"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getTeams, getTeamMembers } from "@/lib/actions/roster";
import {
  saveAttendance,
  getAttendanceByTeamAndDate,
} from "@/lib/actions/attendance";
import { getTodayIST, formatDateDisplay, dateToISTString } from "@/lib/date-utils";
import type { Team, Member, AttendanceRow } from "@/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AttendanceGrid } from "@/components/attendance/AttendanceGrid";
import { CalendarIcon, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const LAST_TEAM_KEY = "csi-last-team";

function MarkAttendanceContent() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [lectureCount, setLectureCount] = useState(6);
  const [members, setMembers] = useState<Member[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingData, setExistingData] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateStr = dateToISTString(selectedDate);

  // Load teams
  useEffect(() => {
    async function load() {
      try {
        const t = await getTeams();
        setTeams(t);
        const lastTeam = localStorage.getItem(LAST_TEAM_KEY);
        if (lastTeam && t.some((team) => team.id === lastTeam)) {
          setSelectedTeam(lastTeam);
        } else if (t.length > 0) {
          setSelectedTeam(t[0].id);
        }
      } catch {
        toast.error("Failed to load teams");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load members + existing attendance when team or date changes
  const loadData = useCallback(async () => {
    if (!selectedTeam) return;

    setMembersLoading(true);
    try {
      const [teamMembers, existing] = await Promise.all([
        getTeamMembers(selectedTeam),
        getAttendanceByTeamAndDate(selectedTeam, dateStr),
      ]);

      setMembers(teamMembers);

      // Build rows — merge with existing attendance data if any
      const existingMap = new Map(
        existing.map((r) => [r.memberId, r])
      );

      const hasExisting = existing.length > 0;
      setExistingData(hasExisting);

      // If existing data has a different lecture count, use it
      if (hasExisting && existing[0]?.lectureCount) {
        setLectureCount(existing[0].lectureCount);
      }

      const currentLectureCount = hasExisting && existing[0]?.lectureCount
        ? existing[0].lectureCount
        : lectureCount;

      const newRows: AttendanceRow[] = teamMembers.map((member) => {
        const existingRecord = existingMap.get(member.id);
        if (existingRecord) {
          // Resize lectures array if lecture count changed
          const lectures = [...existingRecord.lectures];
          while (lectures.length < currentLectureCount) lectures.push(false);
          return {
            memberId: member.id,
            memberName: member.name,
            lectures: lectures.slice(0, currentLectureCount),
            totalMissed: lectures.slice(0, currentLectureCount).filter(Boolean).length,
          };
        }
        return {
          memberId: member.id,
          memberName: member.name,
          lectures: new Array(currentLectureCount).fill(false),
          totalMissed: 0,
        };
      });

      setRows(newRows);
    } catch {
      toast.error("Failed to load attendance data");
    } finally {
      setMembersLoading(false);
    }
  }, [selectedTeam, dateStr, lectureCount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle team change
  const handleTeamChange = (teamId: string) => {
    setSelectedTeam(teamId);
    localStorage.setItem(LAST_TEAM_KEY, teamId);
  };

  // Handle lecture count change
  const handleLectureCountChange = (count: number) => {
    const clamped = Math.max(1, Math.min(10, count));
    setLectureCount(clamped);

    // Resize all rows
    setRows((prev) =>
      prev.map((row) => {
        const lectures = [...row.lectures];
        while (lectures.length < clamped) lectures.push(false);
        const sliced = lectures.slice(0, clamped);
        return {
          ...row,
          lectures: sliced,
          totalMissed: sliced.filter(Boolean).length,
        };
      })
    );
  };

  // Handle checkbox toggle
  const handleToggle = (memberIndex: number, lectureIndex: number) => {
    setRows((prev) => {
      const newRows = [...prev];
      const row = { ...newRows[memberIndex] };
      const lectures = [...row.lectures];
      lectures[lectureIndex] = !lectures[lectureIndex];
      row.lectures = lectures;
      row.totalMissed = lectures.filter(Boolean).length;
      newRows[memberIndex] = row;
      return newRows;
    });
  };

  // Save attendance
  const handleSave = async () => {
    if (!user?.email) return;

    setSaving(true);
    try {
      await saveAttendance(
        selectedTeam,
        dateStr,
        lectureCount,
        rows,
        user.email
      );
      setExistingData(true);
      toast.success(
        `Attendance ${existingData ? "updated" : "saved"} for ${formatDateDisplay(dateStr)}`
      );
    } catch {
      toast.error("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const currentTeam = teams.find((t) => t.id === selectedTeam);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          Mark Attendance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record lecture attendance for team members
        </p>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Team Tabs */}
        <Tabs value={selectedTeam} onValueChange={handleTeamChange}>
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

        {/* Date + Lecture Count */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium hover:bg-muted w-48 justify-start text-left font-normal"
              >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd MMM yyyy")}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lecture-count">Lectures</Label>
            <Input
              id="lecture-count"
              type="number"
              min={1}
              max={10}
              value={lectureCount}
              onChange={(e) =>
                handleLectureCountChange(parseInt(e.target.value) || 6)
              }
              className="w-20"
            />
          </div>

          {existingData && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 pb-0.5">
              <AlertCircle className="h-4 w-4" />
              <span>Editing existing record</span>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Grid */}
      {membersLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border bg-card flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">
            No active members in {currentTeam?.name || "this team"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add members via the Roster page first
          </p>
        </div>
      ) : (
        <>
          <AttendanceGrid
            rows={rows}
            lectureCount={lectureCount}
            onToggle={handleToggle}
          />

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleSave}
              disabled={saving}
              className="min-w-36"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {existingData ? "Update Attendance" : "Save Attendance"}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function MarkAttendancePage() {
  return (
    <ProtectedRoute>
      <MarkAttendanceContent />
    </ProtectedRoute>
  );
}
