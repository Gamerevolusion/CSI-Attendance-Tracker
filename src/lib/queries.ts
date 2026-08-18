import { useQuery } from '@tanstack/react-query';
import {
  getTeams,
  getTeamMembers,
} from '@/lib/actions/roster';
import {
  getCurriculums,
  getSubjects,
} from '@/lib/actions/curriculum';
import { getAuthorizedUsers } from '@/lib/actions/users';
import {
  getAttendanceByTeamAndDate,
  getAttendanceByTeamAndDateRange,
} from '@/lib/actions/attendance';
import { getEntriesByTeam, getEntriesByMember } from '@/lib/actions/attendanceEntries';
import { dateToISTString } from '@/lib/date-utils';
import type { Team, Member, Curriculum, Subject, AuthorizedUser, AttendanceRecord, AttendanceEntry } from '@/types';

// Query Keys - centralized for consistency
export const queryKeys = {
  teams: ['teams'] as const,
  teamMembers: (teamId: string, activeOnly?: boolean) => ['teamMembers', teamId, activeOnly] as const,
  curriculums: ['curriculums'] as const,
  subjects: (curriculumId: string) => ['subjects', curriculumId] as const,
  authorizedUsers: ['authorizedUsers'] as const,
  attendanceByTeamAndDate: (teamId: string, date: string) => ['attendance', teamId, date] as const,
  attendanceByTeamAndDateRange: (teamId: string, startDate: string, endDate: string) => ['attendanceRange', teamId, startDate, endDate] as const,
  entriesByTeam: (teamId: string, startDate: string, endDate: string) => ['entries', teamId, startDate, endDate] as const,
  entriesByMember: (memberId: string, startDate: string, endDate: string) => ['entriesMember', memberId, startDate, endDate] as const,
  reportData: (teamIds: string[], startDate: string, endDate: string) => ['report', teamIds, startDate, endDate] as const,
};

// Teams
export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: getTeams,
  });
}

// Team Members
export function useTeamMembers(teamId: string, activeOnly = true) {
  return useQuery({
    queryKey: queryKeys.teamMembers(teamId, activeOnly),
    queryFn: () => getTeamMembers(teamId, activeOnly),
    enabled: !!teamId,
  });
}

// Curriculums
export function useCurriculums() {
  return useQuery({
    queryKey: queryKeys.curriculums,
    queryFn: getCurriculums,
  });
}

// Subjects for a specific curriculum
export function useSubjects(curriculumId: string) {
  return useQuery({
    queryKey: queryKeys.subjects(curriculumId),
    queryFn: () => getSubjects(curriculumId),
    enabled: !!curriculumId,
  });
}

// Authorized Users
export function useAuthorizedUsers() {
  return useQuery({
    queryKey: queryKeys.authorizedUsers,
    queryFn: getAuthorizedUsers,
  });
}

// Attendance by team and date (single day)
export function useAttendanceByTeamAndDate(teamId: string, date: string) {
  return useQuery({
    queryKey: queryKeys.attendanceByTeamAndDate(teamId, date),
    queryFn: () => getAttendanceByTeamAndDate(teamId, date),
    enabled: !!teamId && !!date,
  });
}

// Attendance by team and date range
export function useAttendanceByTeamAndDateRange(teamId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.attendanceByTeamAndDateRange(teamId, startDate, endDate),
    queryFn: () => getAttendanceByTeamAndDateRange(teamId, startDate, endDate),
    enabled: !!teamId && !!startDate && !!endDate,
  });
}

// Attendance entries by team and date range
export function useEntriesByTeam(teamId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.entriesByTeam(teamId, startDate, endDate),
    queryFn: () => getEntriesByTeam(teamId, startDate, endDate),
    enabled: !!teamId && !!startDate && !!endDate,
  });
}

// Attendance entries by member and date range
export function useEntriesByMember(memberId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.entriesByMember(memberId, startDate, endDate),
    queryFn: () => getEntriesByMember(memberId, startDate, endDate),
    enabled: !!memberId && !!startDate && !!endDate,
  });
}

// Helper hook to get dates array from date range
export function useDateRange(dateFrom: Date | null, dateTo: Date | null) {
  return useQuery({
    queryKey: ['dateRange', dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: () => {
      if (!dateFrom || !dateTo) return [];
      // Import eachDayOfInterval dynamically to avoid SSR issues
      const { eachDayOfInterval } = require('date-fns');
      return eachDayOfInterval({ start: dateFrom, end: dateTo }).map(dateToISTString);
    },
    enabled: !!dateFrom && !!dateTo,
  });
}