import { useQuery } from '@tanstack/react-query';
import {
  getTeams,
  getTeamMembers,
} from '@/lib/actions/roster';
import {
  getCurriculums,
  getSubjects,
} from '@/lib/actions/curriculum';
import { getEntriesByTeam } from '@/lib/actions/attendanceEntries';
import { dateToISTString } from '@/lib/date-utils';
import { queryKeys } from '@/lib/queries';
import type { Team, Subject, ReportSummaryRow } from '@/types';

// Teams
export function useTeams() {
  return useQuery<Team[]>({
    queryKey: queryKeys.teams,
    queryFn: getTeams,
  });
}

// Curriculums
export function useCurriculums() {
  return useQuery({
    queryKey: queryKeys.curriculums,
    queryFn: getCurriculums,
  });
}

// Subjects for a curriculum
export function useSubjects(curriculumId: string) {
  return useQuery({
    queryKey: queryKeys.subjects(curriculumId),
    queryFn: () => getSubjects(curriculumId),
    enabled: !!curriculumId,
  });
}

// Team members
export function useTeamMembers(teamId: string, activeOnly = true) {
  return useQuery({
    queryKey: queryKeys.teamMembers(teamId, activeOnly),
    queryFn: () => getTeamMembers(teamId, activeOnly),
    enabled: !!teamId,
  });
}

// Entries by team
export function useEntriesByTeam(teamId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.entriesByTeam(teamId, startDate, endDate),
    queryFn: () => getEntriesByTeam(teamId, startDate, endDate),
    enabled: !!teamId && !!startDate && !!endDate,
  });
}

// Pre-built subject map for display
export function useSubjectMap(curriculums: any[]) {
  return useQuery({
    queryKey: ['subjectMap', curriculums.map(c => c.id).sort()],
    queryFn: async () => {
      const sMap: Record<string, Subject> = {};
      const results = await Promise.all(
        curriculums.map(curr => getSubjects(curr.id).then(subjects => ({ id: curr.id, subjects })))
      );
      for (const { subjects } of results) {
        for (const sub of subjects) {
          sMap[sub.id] = sub;
        }
      }
      return sMap;
    },
    enabled: curriculums.length > 0,
  });
}

// Report data hook - fetches all data for selected teams in parallel
export function useReportData(
  selectedTeamIds: string[],
  dateFrom: Date,
  dateTo: Date,
  teams: Team[],
  subjectMap: Record<string, Subject> = {}
) {
  const startDate = dateToISTString(dateFrom);
  const endDate = dateToISTString(dateTo);

  return useQuery({
    queryKey: queryKeys.reportData(selectedTeamIds, startDate, endDate),
    queryFn: async () => {
      const newPreview = new Map<string, { teamName: string; rows: ReportSummaryRow[] }>();

      // Fetch all data in parallel for each selected team
      const teamPromises = selectedTeamIds.map(async (teamId) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return null;

        const [members, entries] = await Promise.all([
          getTeamMembers(teamId, true),
          getEntriesByTeam(teamId, startDate, endDate),
        ]);

        // Build summary per member with subject breakdown
        const memberMap = new Map<
          string,
          ReportSummaryRow & {
            dates: Set<string>;
            subjectMissed: Record<string, number>;
          }
        >();

        for (const m of members) {
          memberMap.set(m.id, {
            memberId: m.id,
            memberName: m.name,
            role: m.role,
            year: m.year,
            department: m.department,
            totalMissed: 0,
            sessionsRecorded: 0,
            dates: new Set(),
            subjectMissed: {},
          });
        }

        for (const entry of entries) {
          const member = memberMap.get(entry.memberId);
          if (member) {
            member.totalMissed += entry.missed;
            member.dates.add(entry.date);

            if (!member.subjectMissed[entry.subjectId]) {
              member.subjectMissed[entry.subjectId] = 0;
            }
            member.subjectMissed[entry.subjectId] += entry.missed;
          }
        }

        const rows: ReportSummaryRow[] = Array.from(memberMap.values()).map(
          ({ dates, subjectMissed, ...rest }) => ({
            ...rest,
            sessionsRecorded: dates.size,
            subjectBreakdown: Object.entries(subjectMissed).map(
              ([subId, missed]) => ({
                subjectName: subjectMap[subId]?.subjectName || subId,
                facultyName: subjectMap[subId]?.facultyName || '—',
                missed,
              })
            ),
          })
        );

        return { teamId, teamName: team.name, rows };
      });

      const results = await Promise.all(teamPromises);
      for (const result of results) {
        if (result) {
          newPreview.set(result.teamId, { teamName: result.teamName, rows: result.rows });
        }
      }

      return newPreview;
    },
    enabled: selectedTeamIds.length > 0,
  });
}