"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuthUser, useAuthPermissions } from "@/contexts/AuthContext";
import { HeadRoute } from "@/components/HeadRoute";
import { getTeams, getTeamMembers } from "@/lib/actions/roster";
import { getCurriculums, getSubjects } from "@/lib/actions/curriculum";
import { getEntriesByTeam } from "@/lib/actions/attendanceEntries";
import { dateToISTString } from "@/lib/date-utils";
import type { Team, Member, Subject, Curriculum, AttendanceEntry } from "@/types";
import { MemberAttendanceCard } from "@/components/attendance/MemberAttendanceCard";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";

const LAST_TEAM_KEY = "csi-last-team";

function MarkAttendanceContent() {
  const { user } = useAuthUser();
  const { accessLevel, teamId: userTeamId } = useAuthPermissions();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Date range — default to current month
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(() => {
    const today = new Date();
    return today < endOfMonth(today) ? today : endOfMonth(today);
  });
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // Data
  const [members, setMembers] = useState<Member[]>([]);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [subjectsByCurriculum, setSubjectsByCurriculum] = useState<
    Record<string, Subject[]>
  >({});
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);

  // Compute date strings
  const dates = useMemo(() => {
    try {
      return eachDayOfInterval({ start: dateFrom, end: dateTo }).map((d) =>
        dateToISTString(d)
      );
    } catch {
      return [];
    }
  }, [dateFrom, dateTo]);

  // Load teams and curriculums (lightweight)
  useEffect(() => {
    async function load() {
      try {
        const [t, c] = await Promise.all([getTeams(), getCurriculums()]);
        setTeams(t);
        setCurriculums(c);

        // If Head, lock to their assigned team
        if (accessLevel === "Head's Access" && userTeamId && t.some((team) => team.id === userTeamId)) {
          setSelectedTeam(userTeamId);
        } else {
          const lastTeam = localStorage.getItem(LAST_TEAM_KEY);
          if (lastTeam && t.some((team) => team.id === lastTeam)) {
            setSelectedTeam(lastTeam);
          } else if (t.length > 0) {
            setSelectedTeam(t[0].id);
          }
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [accessLevel, userTeamId]);

  // Ref to track loaded curriculum IDs without triggering re-renders
  const loadedCurriculumsRef = useRef<Set<string>>(new Set());

  // Load subjects for the loaded members' year/department combinations
  useEffect(() => {
    if (!members.length || !curriculums.length) return;

    async function loadSubjects() {
      try {
        // Collect unique curriculum IDs from members
        const currIds = new Set(members.map(m => `${m.year}_${m.department}`));
        
        for (const currId of currIds) {
          if (loadedCurriculumsRef.current.has(currId)) continue; // already loaded
          loadedCurriculumsRef.current.add(currId);
          const subjects = await getSubjects(currId);
          setSubjectsByCurriculum(prev => ({
            ...prev,
            [currId]: subjects,
          }));
        }
      } catch {
        toast.error("Failed to load subjects");
      }
    }
    loadSubjects();
  }, [members, curriculums]);

  // Load members + entries when team or date range changes
  useEffect(() => {
    if (!selectedTeam || dates.length === 0) return;
    let cancelled = false;

    async function fetchData() {
      setDataLoading(true);
      try {
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];

        let teamMembers: any[] = [];
        try {
          teamMembers = await getTeamMembers(selectedTeam);
        } catch (err) {
          console.error("Failed to load team members:", err);
          if (!cancelled) toast.error("Failed to load team members");
        }

        let teamEntries: any[] = [];
        try {
          teamEntries = await getEntriesByTeam(selectedTeam, startDate, endDate);
        } catch (err) {
          console.error("Failed to load attendance entries:", err);
          if (!cancelled) toast.error("Failed to load attendance entries");
        }

        if (cancelled) return;
        setMembers(teamMembers);
        setEntries(teamEntries);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [selectedTeam, dates]);

  const handleTeamChange = (teamId: string) => {
    setSelectedTeam(teamId);
    localStorage.setItem(LAST_TEAM_KEY, teamId);
  };

  // Get subjects for a member based on their year + department
  const getSubjectsForMember = (member: Member): Subject[] => {
    const currId = `${member.year}_${member.department}`;
    return subjectsByCurriculum[currId] || [];
  };

  // Get entries for a specific member
  const getEntriesForMember = (memberId: string): AttendanceEntry[] => {
    return entries.filter((e) => e.memberId === memberId);
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="neo-raised p-6 animate-pulse">
          <div className="h-6 w-48 rounded bg-current opacity-10" />
          <div className="h-4 w-64 rounded bg-current opacity-5 mt-2" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="neo-card animate-pulse">
            <div className="h-5 w-40 rounded bg-current opacity-10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            Mark Attendance
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--neo-text-muted)" }}>
            Per-subject attendance tracking for team members
          </p>
        </div>

        {/* Controls */}
        <div className="neo-raised p-3 sm:p-5 space-y-3 sm:space-y-4">
          {/* Team tabs */}
          <div className="neo-pressed p-1.5 rounded-2xl">
            <div className="neo-scroll-x flex gap-1.5 p-1">
              {teams.map((team) => {
                const isLocked = accessLevel === "Head's Access" && userTeamId && team.id !== userTeamId;
                return (
                  <button
                    key={team.id}
                    type="button"
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm whitespace-nowrap font-medium transition-all duration-150 shrink-0 ${
                      selectedTeam === team.id
                        ? "neo-raised font-bold text-foreground"
                        : "text-muted-foreground hover:text-foreground opacity-80"
                    } ${isLocked ? "hidden" : ""}`}
                    onClick={() => handleTeamChange(team.id)}
                    disabled={!!isLocked}
                  >
                    {team.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="flex-1 sm:flex-initial space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--neo-text-muted)" }}>
                  From
                </label>
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger className="neo-btn flex items-center gap-2 px-3 py-2.5 text-sm w-full sm:w-auto">
                    <CalendarIcon className="h-4 w-4 opacity-60" />
                    {format(dateFrom, "dd MMM yyyy")}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => {
                        if (d) {
                          setDateFrom(d);
                          setFromOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1 sm:flex-initial space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--neo-text-muted)" }}>
                  To
                </label>
                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger className="neo-btn flex items-center gap-2 px-3 py-2.5 text-sm w-full sm:w-auto">
                    <CalendarIcon className="h-4 w-4 opacity-60" />
                    {format(dateTo, "dd MMM yyyy")}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => {
                        if (d) {
                          setDateTo(d);
                          setToOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="text-xs" style={{ color: "var(--neo-text-muted)" }}>
              {dates.length} day{dates.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Member Cards */}
        {dataLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--neo-text-muted)" }} />
          </div>
        ) : members.length === 0 ? (
          <div className="neo-pressed p-12 text-center">
            <p className="text-sm" style={{ color: "var(--neo-text-muted)" }}>
              No active members in this team
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--neo-text-muted)", opacity: 0.7 }}>
              Add members via the Roster page
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <MemberAttendanceCard
                key={member.id}
                member={member}
                teamId={selectedTeam}
                subjects={getSubjectsForMember(member)}
                dates={dates}
                existingEntries={getEntriesForMember(member.id)}
                markedByEmail={user?.email || ""}
              />
            ))}
          </div>
        )}
    </div>
  );
}

export default function MarkAttendancePage() {
  return (
    <HeadRoute>
      <MarkAttendanceContent />
    </HeadRoute>
  );
}