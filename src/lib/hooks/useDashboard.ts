import { useMemo } from 'react';
import { useTeams, useTeamMembers, useAttendanceByTeamAndDate, useAttendanceByTeamAndDateRange } from '@/lib/queries';
import { getTodayIST, dateToISTString } from '@/lib/date-utils';
import type { Team, Member, AttendanceRecord } from '@/types';

interface DashboardData {
  teams: Team[];
  selectedTeam: string;
  members: Member[];
  todayRecords: AttendanceRecord[];
  filteredRecords: AttendanceRecord[];
  totalMembers: number;
  todayMarked: boolean;
  todayCount: number;
  attendanceSummary: {
    id: string;
    name: string;
    year: string;
    department: string;
    totalMissed: number;
    sessions: number;
    recorded: boolean;
  }[];
  maxSessions: number;
}

interface UseDashboardOptions {
  accessLevel: 'Admin' | "Head's Access" | "Member's Access";
  userTeamId: string | null | undefined;
  user?: { email?: string | null } | null;
  filterMode: 'date' | 'range';
  selectedDate: Date;
  dateFrom: Date;
  dateTo: Date;
}

export function useDashboardData({
  accessLevel,
  userTeamId,
  user,
  filterMode,
  selectedDate,
  dateFrom,
  dateTo,
}: UseDashboardOptions) {
  // Get teams
  const { data: teams = [], isLoading: teamsLoading } = useTeams();

  // Determine selected team
  const selectedTeam = useMemo(() => {
    if (!teams.length) return '';
    if (accessLevel !== 'Admin' && userTeamId && teams.some(t => t.id === userTeamId)) {
      return userTeamId;
    }
    return teams[0].id;
  }, [teams, accessLevel, userTeamId]);

  // Get team members
  const { data: members = [], isLoading: membersLoading } = useTeamMembers(selectedTeam);

  // Today's date in IST
  const today = getTodayIST();

  // Get today's records
  const { data: todayRecords = [], isLoading: todayLoading } = useAttendanceByTeamAndDate(selectedTeam, today);

  // Get filtered records based on mode
  const targetDateStr = dateToISTString(selectedDate);
  const fromDateStr = dateToISTString(dateFrom);
  const toDateStr = dateToISTString(dateTo);

  const { data: dateRecords = [], isLoading: dateLoading } = useAttendanceByTeamAndDate(selectedTeam, targetDateStr);
  const { data: rangeRecords = [], isLoading: rangeLoading } = useAttendanceByTeamAndDateRange(selectedTeam, fromDateStr, toDateStr);

  const filteredRecords = filterMode === 'date' ? dateRecords : rangeRecords;

  // Compute derived data
  const loading = teamsLoading || membersLoading || todayLoading || (filterMode === 'date' ? dateLoading : rangeLoading);
  const dataLoading = membersLoading || todayLoading || (filterMode === 'date' ? dateLoading : rangeLoading);

  // Compute attendance summary using useMemo (only recalculates when inputs change)
  const attendanceSummary = useMemo(() => {
    if (!members.length) return [];

    const activeMemberIds = new Set(members.map(m => m.id));

    const memberMap = new Map<string, {
      id: string;
      name: string;
      year: string;
      department: string;
      totalMissed: number;
      dates: Set<string>;
    }>();

    for (const m of members) {
      memberMap.set(m.id, {
        id: m.id,
        name: m.name,
        year: m.year,
        department: m.department,
        totalMissed: 0,
        dates: new Set(),
      });
    }

    for (const record of filteredRecords) {
      const entry = memberMap.get(record.memberId);
      if (entry) {
        entry.totalMissed += record.totalMissed;
        entry.dates.add(record.date);
      }
    }

    const summary = Array.from(memberMap.values())
      .map(entry => ({
        id: entry.id,
        name: entry.name,
        year: entry.year,
        department: entry.department,
        totalMissed: entry.totalMissed,
        sessions: entry.dates.size,
        recorded: entry.dates.size > 0,
      }))
      .sort((a, b) => b.totalMissed - a.totalMissed);

    // For Member access, filter summary to only show their own data
    // This logic is kept from original but note: we don't have email->memberId mapping here
    // The original comment mentioned keeping full summary for "Your Team's Attendance"
    return summary;
  }, [members, filteredRecords]);

  const maxSessions = useMemo(() => {
    if (!attendanceSummary.length) return 0;
    return Math.max(...attendanceSummary.map(d => d.sessions));
  }, [attendanceSummary]);

  const totalMembers = members.length;
  const validTodayRecords = useMemo(() => {
    const activeMemberIds = new Set(members.map(m => m.id));
    return todayRecords.filter(r => activeMemberIds.has(r.memberId));
  }, [members, todayRecords]);

  const todayMarked = validTodayRecords.length > 0;
  const todayCount = validTodayRecords.length;

  return {
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
  };
}