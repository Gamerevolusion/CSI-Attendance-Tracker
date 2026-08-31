"use client";

import { useState, useEffect } from "react";
import { useAuthUser, useAuthPermissions } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getTeamMembers } from "@/lib/actions/roster";
import { getEntriesByTeam } from "@/lib/actions/attendanceEntries";
import { dateToISTString } from "@/lib/date-utils";
import type { Team, ReportSummaryRow, Subject } from "@/types";
import { useTeams, useCurriculums, useSubjectMap, useReportData } from "@/lib/hooks/useReports";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VirtualizedTable } from "@/components/ui/VirtualizedTable";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Download, FileText, Loader2, Eye, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function ReportsContent() {
  const { user } = useAuthUser();
  const { accessLevel, teamId: userTeamId } = useAuthPermissions();
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Date range
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // Preview data
  const [previewData, setPreviewData] = useState<
    Map<string, { teamName: string; rows: ReportSummaryRow[] }>
  >(new Map());

  // Subject lookup for display
  const [subjectMap, setSubjectMap] = useState<Record<string, Subject>>({});

  // Use React Query hooks for data fetching
  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: curriculums = [], isLoading: curriculumsLoading } = useCurriculums();
  const { data: subjectMapData = {}, isLoading: subjectMapLoading } = useSubjectMap(curriculums);

  // Update subject map when data loads
  useEffect(() => {
    if (Object.keys(subjectMapData).length > 0) {
      setSubjectMap(subjectMapData);
    }
  }, [subjectMapData]);

  // Auto-select team for Head / Member
  useEffect(() => {
    if (accessLevel !== "Admin" && userTeamId && teams.length > 0) {
      setSelectedTeamIds(new Set([userTeamId]));
    }
  }, [accessLevel, userTeamId, teams]);

  // Report data hook
  const { data: reportData, isLoading: reportLoading, refetch: refetchReport } = useReportData(
    Array.from(selectedTeamIds),
    dateFrom,
    dateTo,
    teams,
    subjectMap
  );

  // Update preview data when report data loads
  useEffect(() => {
    if (reportData) {
      setPreviewData(reportData);
    }
  }, [reportData]);

  const loading = teamsLoading || curriculumsLoading;

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTeamIds.size === teams.length) {
      setSelectedTeamIds(new Set());
    } else {
      setSelectedTeamIds(new Set(teams.map((t) => t.id)));
    }
  };

  const handlePreview = async () => {
    if (selectedTeamIds.size === 0) {
      toast.error("Please select at least one team");
      return;
    }
    setPreviewing(true);
    try {
      await refetchReport();
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setPreviewing(false);
    }
  };

  // ── Styling constants ──
  const NAVY = 'FF1A2B4C';
  const TEAL = 'FF0F766E';
  const LIGHT_BG = 'FFF8FAFC';
  const BORDER_COLOR = 'FFE2E8F0';
  const GREEN_BG = 'FFDCFCE7';
  const GREEN_TEXT = 'FF15803D';
  const RED_BG = 'FFFEE2E2';
  const RED_TEXT = 'FFB91C1C';
  const AMBER_BG = 'FFFEF3C7';
  const AMBER_TEXT = 'FF92400E';

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } },
  };

  const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  const tealFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };

  const applyHeaderStyle = (row: ExcelJS.Row, fill: ExcelJS.FillPattern = headerFill) => {
    row.eachCell((cell) => {
      cell.fill = fill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder;
    });
    row.height = 24;
  };

  // Excel export helper
  const generateExcelData = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CSI Attendance Portal';
    workbook.created = new Date();

    const startDate = dateToISTString(dateFrom);
    const endDate = dateToISTString(dateTo);
    const genDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    // ═══════════════════════════════════════════
    // SHEET 1: Summary
    // ═══════════════════════════════════════════
    const summarySheet = workbook.addWorksheet('Summary', {
      views: [{ state: 'frozen', ySplit: 5 }],
    });

    // Title block
    summarySheet.mergeCells('A1:H1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'CSI ATTENDANCE REPORT';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = headerFill;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 30;

    summarySheet.mergeCells('A2:H2');
    const periodCell = summarySheet.getCell('A2');
    periodCell.value = `Period: ${startDate} to ${endDate}  |  Generated: ${genDate}`;
    periodCell.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
    periodCell.alignment = { horizontal: 'center' };
    periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };

    // Empty row 3-4
    summarySheet.getRow(3).height = 6;
    summarySheet.getRow(4).height = 6;

    // Header row
    const summaryHeaders = ['Team', 'Member Name', 'Year', 'Department', 'Role', 'Sessions', 'Missed Lectures', 'Status'];
    const summaryHeaderRow = summarySheet.getRow(5);
    summaryHeaders.forEach((h, i) => { summaryHeaderRow.getCell(i + 1).value = h; });
    applyHeaderStyle(summaryHeaderRow);
    summaryHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    summaryHeaderRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    // Column widths
    summarySheet.columns = [
      { width: 22 }, { width: 24 }, { width: 10 }, { width: 14 },
      { width: 14 }, { width: 12 }, { width: 18 }, { width: 20 },
    ];

    // Data rows
    let rowIdx = 6;
    Array.from(previewData.entries()).forEach(([, { teamName, rows }]) => {
      rows.forEach((row) => {
        const status = row.totalMissed === 0 ? 'Perfect' : 'Partially Absent';
        const excelRow = summarySheet.getRow(rowIdx);
        excelRow.values = [
          teamName, row.memberName, row.year, row.department,
          row.role || 'Member', row.sessionsRecorded, row.totalMissed, status,
        ];

        // Striped rows
        if (rowIdx % 2 === 0) {
          excelRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
          });
        }

        // Style status + missed columns
        const missedCell = excelRow.getCell(7);
        const statusCell = excelRow.getCell(8);

        if (row.totalMissed === 0) {
          missedCell.font = { bold: true, color: { argb: GREEN_TEXT } };
          statusCell.font = { bold: true, color: { argb: GREEN_TEXT } };
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_BG } };
        } else if (row.totalMissed >= 5) {
          missedCell.font = { bold: true, color: { argb: RED_TEXT } };
          statusCell.font = { bold: true, color: { argb: RED_TEXT } };
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_BG } };
        } else {
          missedCell.font = { bold: true, color: { argb: AMBER_TEXT } };
          statusCell.font = { bold: true, color: { argb: AMBER_TEXT } };
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_BG } };
        }

        missedCell.alignment = { horizontal: 'center' };
        statusCell.alignment = { horizontal: 'center' };

        excelRow.eachCell((cell) => { cell.border = thinBorder; });
        rowIdx++;
      });
    });

    // ═══════════════════════════════════════════
    // SHEET 2+: Date-wise Attendance per team
    // ═══════════════════════════════════════════
    for (const teamId of selectedTeamIds) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) continue;

      const [members, entries] = await Promise.all([
        getTeamMembers(teamId, true),
        getEntriesByTeam(teamId, startDate, endDate),
      ]);
      if (members.length === 0) continue;

      const allDates = Array.from(new Set(entries.map(e => e.date))).sort();
      if (allDates.length === 0) continue;

      // Build member → date → missed
      const memberDateMap = new Map<string, {
        name: string; year: string; dept: string;
        dates: Map<string, number>;
      }>();
      for (const m of members) {
        memberDateMap.set(m.id, { name: m.name, year: m.year, dept: m.department, dates: new Map() });
      }
      for (const entry of entries) {
        const member = memberDateMap.get(entry.memberId);
        if (member) {
          member.dates.set(entry.date, (member.dates.get(entry.date) || 0) + entry.missed);
        }
      }

      const formatShort = (d: string) => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      };

      const safeSheetName = `${team.name} Daily`.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      const dateSheet = workbook.addWorksheet(safeSheetName, {
        views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }],
      });

      // Title
      const totalCols = 3 + allDates.length + 1;
      dateSheet.mergeCells(1, 1, 1, totalCols);
      const dtTitle = dateSheet.getCell(1, 1);
      dtTitle.value = `DATE-WISE ATTENDANCE: ${team.name.toUpperCase()}`;
      dtTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      dtTitle.fill = headerFill;
      dtTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      dateSheet.getRow(1).height = 26;

      dateSheet.mergeCells(2, 1, 2, totalCols);
      const dtPeriod = dateSheet.getCell(2, 1);
      dtPeriod.value = `Period: ${startDate} to ${endDate}  |  0 = Present  •  Blank = No Record  •  Number = Missed Lectures`;
      dtPeriod.font = { size: 8, italic: true, color: { argb: 'FF64748B' } };
      dtPeriod.alignment = { horizontal: 'center' };
      dtPeriod.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };

      // Header row
      const dateHeaders = ['Student Name', 'Year', 'Dept', ...allDates.map(formatShort), 'Total'];
      const dtHeaderRow = dateSheet.getRow(3);
      dateHeaders.forEach((h, i) => { dtHeaderRow.getCell(i + 1).value = h; });
      applyHeaderStyle(dtHeaderRow);
      dtHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

      // Column widths
      dateSheet.getColumn(1).width = 22;
      dateSheet.getColumn(2).width = 7;
      dateSheet.getColumn(3).width = 7;
      for (let i = 0; i < allDates.length; i++) { dateSheet.getColumn(4 + i).width = 8; }
      dateSheet.getColumn(4 + allDates.length).width = 10;

      // Data rows
      const sortedMembers = Array.from(memberDateMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      let dateRowIdx = 4;
      for (const member of sortedMembers) {
        let total = 0;
        const excelRow = dateSheet.getRow(dateRowIdx);
        excelRow.getCell(1).value = member.name;
        excelRow.getCell(1).font = { bold: true, size: 9 };
        excelRow.getCell(1).alignment = { horizontal: 'left' };
        excelRow.getCell(2).value = member.year;
        excelRow.getCell(2).font = { size: 8 };
        excelRow.getCell(3).value = member.dept;
        excelRow.getCell(3).font = { size: 8 };

        for (let i = 0; i < allDates.length; i++) {
          const missed = member.dates.get(allDates[i]);
          const cell = excelRow.getCell(4 + i);
          if (missed !== undefined) {
            cell.value = missed;
            total += missed;
            if (missed === 0) {
              cell.font = { bold: true, size: 9, color: { argb: GREEN_TEXT } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_BG } };
            } else {
              cell.font = { bold: true, size: 9, color: { argb: RED_TEXT } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_BG } };
            }
          } else {
            cell.value = '';
          }
          cell.alignment = { horizontal: 'center' };
        }

        // Total column
        const totalCell = excelRow.getCell(4 + allDates.length);
        totalCell.value = total;
        totalCell.font = { bold: true, size: 10, color: { argb: total === 0 ? GREEN_TEXT : RED_TEXT } };
        totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
        totalCell.alignment = { horizontal: 'center' };

        // Borders + striping
        excelRow.eachCell((cell) => { cell.border = thinBorder; });
        if (dateRowIdx % 2 === 1) {
          excelRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
          excelRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
          excelRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
        }
        dateRowIdx++;
      }
    }

    // ═══════════════════════════════════════════
    // SHEET 3+: Subject Breakdown per team
    // ═══════════════════════════════════════════
    Array.from(previewData.entries()).forEach(([, { teamName, rows }]) => {
      const missedEntries: { member: string; subject: string; faculty: string; missed: number }[] = [];
      rows.forEach(row => {
        row.subjectBreakdown?.forEach(sub => {
          if (sub.missed > 0) {
            missedEntries.push({
              member: row.memberName,
              subject: sub.subjectName,
              faculty: sub.facultyName || '—',
              missed: sub.missed,
            });
          }
        });
      });

      if (missedEntries.length === 0) return;

      const safeSheetName = `${teamName} Subjects`.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      const subSheet = workbook.addWorksheet(safeSheetName, {
        views: [{ state: 'frozen', ySplit: 4 }],
      });

      // Title
      subSheet.mergeCells('A1:D1');
      const subTitle = subSheet.getCell('A1');
      subTitle.value = `SUBJECT BREAKDOWN: ${teamName.toUpperCase()}`;
      subTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      subTitle.fill = tealFill;
      subTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      subSheet.getRow(1).height = 26;

      subSheet.mergeCells('A2:D2');
      const subPeriod = subSheet.getCell('A2');
      subPeriod.value = `Period: ${startDate} to ${endDate}`;
      subPeriod.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
      subPeriod.alignment = { horizontal: 'center' };

      subSheet.getRow(3).height = 6;

      // Header
      const subHeaders = ['Member Name', 'Subject', 'Faculty', 'Missed Lectures'];
      const subHeaderRow = subSheet.getRow(4);
      subHeaders.forEach((h, i) => { subHeaderRow.getCell(i + 1).value = h; });
      applyHeaderStyle(subHeaderRow, tealFill);
      subHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      subHeaderRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      subHeaderRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

      subSheet.getColumn(1).width = 24;
      subSheet.getColumn(2).width = 35;
      subSheet.getColumn(3).width = 22;
      subSheet.getColumn(4).width = 16;

      // Data
      missedEntries.forEach((entry, i) => {
        const r = subSheet.getRow(5 + i);
        r.values = [entry.member, entry.subject, entry.faculty, entry.missed];
        r.getCell(4).font = { bold: true, color: { argb: RED_TEXT } };
        r.getCell(4).alignment = { horizontal: 'center' };
        if (i % 2 === 0) {
          r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
          });
        }
        r.eachCell(cell => { cell.border = thinBorder; });
      });
    });

    // ═══════════════════════════════════════════
    // DEPARTMENT SHEETS: one per department with year sections
    // ═══════════════════════════════════════════
    const DEPT_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; // Indigo
    const YEAR_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };

    // Collect all members across teams grouped by department → year
    type DeptMember = {
      memberName: string;
      team: string;
      year: string;
      role: string | null;
      totalMissed: number;
      sessionsRecorded: number;
      subjectBreakdown?: { subjectName: string; facultyName: string; missed: number }[];
    };

    const deptMap = new Map<string, DeptMember[]>();

    for (const [, { teamName, rows }] of previewData.entries()) {
      for (const row of rows) {
        const dept = row.department || 'Other';
        if (!deptMap.has(dept)) deptMap.set(dept, []);
        deptMap.get(dept)!.push({
          memberName: row.memberName,
          team: teamName,
          year: row.year,
          role: row.role,
          totalMissed: row.totalMissed,
          sessionsRecorded: row.sessionsRecorded,
          subjectBreakdown: row.subjectBreakdown,
        });
      }
    }

    // Define consistent year ordering
    const yearOrder = ['FY', 'SY', 'TY', 'BE'];

    for (const [dept, members] of deptMap.entries()) {
      if (members.length === 0) continue;

      const safeSheetName = `Dept ${dept}`.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      const deptSheet = workbook.addWorksheet(safeSheetName, {
        views: [{ state: 'frozen', ySplit: 3 }],
      });

      // Column widths
      deptSheet.getColumn(1).width = 24;  // Name
      deptSheet.getColumn(2).width = 18;  // Team
      deptSheet.getColumn(3).width = 14;  // Role
      deptSheet.getColumn(4).width = 12;  // Sessions
      deptSheet.getColumn(5).width = 18;  // Missed
      deptSheet.getColumn(6).width = 28;  // Subject
      deptSheet.getColumn(7).width = 20;  // Faculty
      deptSheet.getColumn(8).width = 16;  // Subject Missed

      const totalCols = 8;

      // Title
      deptSheet.mergeCells(1, 1, 1, totalCols);
      const dtTitle = deptSheet.getCell(1, 1);
      dtTitle.value = `DEPARTMENT: ${dept.toUpperCase()}`;
      dtTitle.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
      dtTitle.fill = DEPT_FILL;
      dtTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      deptSheet.getRow(1).height = 28;

      deptSheet.mergeCells(2, 1, 2, totalCols);
      const dtPeriod = deptSheet.getCell(2, 1);
      dtPeriod.value = `Period: ${startDate} to ${endDate}  |  Generated: ${genDate}`;
      dtPeriod.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
      dtPeriod.alignment = { horizontal: 'center' };
      dtPeriod.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };

      let deptRowIdx = 3;

      // Group by year, use consistent ordering
      const years = [...new Set(members.map(m => m.year))].sort((a, b) => {
        const ai = yearOrder.indexOf(a);
        const bi = yearOrder.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

      for (const year of years) {
        const yearMembers = members
          .filter(m => m.year === year)
          .sort((a, b) => a.memberName.localeCompare(b.memberName));

        deptRowIdx++; // blank spacer row

        // Year section header
        deptSheet.mergeCells(deptRowIdx, 1, deptRowIdx, totalCols);
        const yearHeader = deptSheet.getRow(deptRowIdx);
        yearHeader.getCell(1).value = `  ${year} — ${dept}  (${yearMembers.length} member${yearMembers.length !== 1 ? 's' : ''})`;
        yearHeader.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        yearHeader.getCell(1).fill = YEAR_FILL;
        yearHeader.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        yearHeader.height = 24;
        deptRowIdx++;

        // Column headers for this section
        const sectionHeaders = ['Member Name', 'Team', 'Role', 'Sessions', 'Total Missed', 'Subject', 'Faculty', 'Missed'];
        const sHdrRow = deptSheet.getRow(deptRowIdx);
        sectionHeaders.forEach((h, i) => { sHdrRow.getCell(i + 1).value = h; });
        applyHeaderStyle(sHdrRow);
        sHdrRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        sHdrRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        sHdrRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        deptRowIdx++;

        let sectionMissedTotal = 0;

        for (const member of yearMembers) {
          const subBreakdown = (member.subjectBreakdown || []).filter(s => s.missed > 0);
          const rowsNeeded = Math.max(1, subBreakdown.length);

          for (let si = 0; si < rowsNeeded; si++) {
            const excelRow = deptSheet.getRow(deptRowIdx);

            if (si === 0) {
              // First row: member info
              excelRow.getCell(1).value = member.memberName;
              excelRow.getCell(1).font = { bold: true, size: 9 };
              excelRow.getCell(1).alignment = { horizontal: 'left' };
              excelRow.getCell(2).value = member.team;
              excelRow.getCell(2).font = { size: 9 };
              excelRow.getCell(3).value = member.role || 'Member';
              excelRow.getCell(3).font = { size: 9 };
              excelRow.getCell(4).value = member.sessionsRecorded;
              excelRow.getCell(4).alignment = { horizontal: 'center' };

              // Total missed with color
              const missedCell = excelRow.getCell(5);
              missedCell.value = member.totalMissed;
              missedCell.alignment = { horizontal: 'center' };
              if (member.totalMissed === 0) {
                missedCell.font = { bold: true, color: { argb: GREEN_TEXT } };
                missedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_BG } };
              } else if (member.totalMissed >= 5) {
                missedCell.font = { bold: true, color: { argb: RED_TEXT } };
                missedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_BG } };
              } else {
                missedCell.font = { bold: true, color: { argb: AMBER_TEXT } };
                missedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_BG } };
              }

              sectionMissedTotal += member.totalMissed;
            }

            // Subject breakdown (one per row)
            if (si < subBreakdown.length) {
              const sub = subBreakdown[si];
              excelRow.getCell(6).value = sub.subjectName;
              excelRow.getCell(6).font = { size: 9 };
              excelRow.getCell(6).alignment = { horizontal: 'left' };
              excelRow.getCell(7).value = sub.facultyName || '—';
              excelRow.getCell(7).font = { size: 8, color: { argb: 'FF64748B' } };
              excelRow.getCell(7).alignment = { horizontal: 'left' };
              excelRow.getCell(8).value = sub.missed;
              excelRow.getCell(8).font = { bold: true, size: 9, color: { argb: RED_TEXT } };
              excelRow.getCell(8).alignment = { horizontal: 'center' };
            }

            // Alternating row colors
            if (deptRowIdx % 2 === 0) {
              for (let c = 1; c <= totalCols; c++) {
                const cell = excelRow.getCell(c);
                if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === undefined) {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
                }
              }
            }

            excelRow.eachCell(cell => { cell.border = thinBorder; });
            deptRowIdx++;
          }
        }

        // Year section total row
        const totalRow = deptSheet.getRow(deptRowIdx);
        deptSheet.mergeCells(deptRowIdx, 1, deptRowIdx, 4);
        totalRow.getCell(1).value = `  Total — ${year} ${dept}`;
        totalRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        totalRow.getCell(5).value = sectionMissedTotal;
        totalRow.getCell(5).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        totalRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        totalRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        // Fill remaining cells in total row
        for (let c = 6; c <= totalCols; c++) {
          totalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        }
        totalRow.eachCell(cell => { cell.border = thinBorder; });
        totalRow.height = 22;
        deptRowIdx++;
      }
    }

    return workbook;
  };

  const handleDownloadExcel = async () => {
    if (selectedTeamIds.size === 0) {
      toast.error("Please select at least one team");
      return;
    }

    setExportingExcel(true);
    try {
      const workbook = await generateExcelData();
      const fileName = `attendance-report_${dateToISTString(dateFrom)}_${dateToISTString(dateTo)}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
      toast.success("Excel file downloaded successfully");
    } catch (err) {
      console.error("Excel generation error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate Excel report");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleDownload = async () => {
    if (selectedTeamIds.size === 0) {
      toast.error("Please select at least one team");
      return;
    }

    setDownloading(true);
    try {
      const startDate = dateToISTString(dateFrom);
      const endDate = dateToISTString(dateTo);

      // Preload logo for PDF
      let logoBase64: string | null = null;
      try {
        const logoRes = await fetch("/csi.png");
        if (logoRes.ok) {
          const blob = await logoRes.blob();
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        // Fallback without logo image
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let firstPage = true;

      for (const teamId of selectedTeamIds) {
        const team = teams.find((t) => t.id === teamId);
        if (!team) continue;

        if (!firstPage) {
          doc.addPage();
        }
        firstPage = false;

        // Fetch team members and attendance entries
        const [members, entries] = await Promise.all([
          getTeamMembers(teamId, true),
          getEntriesByTeam(teamId, startDate, endDate),
        ]);

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
                facultyName: subjectMap[subId]?.facultyName || "—",
                missed,
              })
            ),
          })
        );

        // Render Top Brand Banner Bar (Navy #1a2b4c)
        doc.setFillColor(26, 43, 76);
        doc.rect(0, 0, 210, 18, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text("COMPUTER SOCIETY OF INDIA", 14, 11);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(203, 213, 225);
        doc.text("STUDENT CHAPTER · ATTENDANCE MANAGEMENT PORTAL", 80, 11);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(56, 189, 248);
        doc.text("OFFICIAL FACULTY REPORT", 196, 11, { align: "right" });

        // Title Block
        let currentY = 26;
        if (logoBase64) {
          doc.addImage(logoBase64, "PNG", 14, 23, 14, 14);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);
          doc.setTextColor(30, 41, 59);
          doc.text("Committee Attendance Summary", 32, 31);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`Team: ${team.name}   |   Period: ${startDate} to ${endDate}`, 32, 37);
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);
          doc.setTextColor(30, 41, 59);
          doc.text("Committee Attendance Summary", 14, 31);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`Team: ${team.name}   |   Period: ${startDate} to ${endDate}`, 14, 37);
        }

        currentY = 44;

        if (rows.length === 0) {
          doc.setFontSize(11);
          doc.setTextColor(100, 116, 139);
          doc.text("No member attendance data recorded for this team in the selected date range.", 14, currentY + 6);
          continue;
        }

        // Summary Statistics Highlight Box
        const totalMembers = rows.length;
        const totalMissedCount = rows.reduce((acc, r) => acc + r.totalMissed, 0);
        const perfectAttendanceCount = rows.filter((r) => r.totalMissed === 0).length;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(14, currentY, 182, 16, 3, 3, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);

        // Stat 1: Members
        doc.text("Total Members:", 18, currentY + 7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(String(totalMembers), 43, currentY + 7);

        // Stat 2: Missed Count
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Total Missed Lectures:", 62, currentY + 7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(totalMissedCount > 0 ? 185 : 21, totalMissedCount > 0 ? 28 : 128, totalMissedCount > 0 ? 28 : 61);
        doc.text(String(totalMissedCount), 98, currentY + 7);

        // Stat 3: Perfect Attendance
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Perfect Attendance:", 118, currentY + 7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(21, 128, 61);
        doc.text(`${perfectAttendanceCount} member(s)`, 148, currentY + 7);

        // Date note inside summary box
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, 18, currentY + 12.5);

        currentY += 22;

        // Primary Attendance Table
        autoTable(doc, {
          startY: currentY,
          head: [["Member Name", "Year / Dept", "Role", "Sessions", "Missed Lectures", "Status"]],
          body: rows.map((r) => [
            r.memberName,
            `${r.year} · ${r.department}`,
            r.role || "Member",
            String(r.sessionsRecorded),
            r.totalMissed === 0 ? "0" : `${r.totalMissed} lecture(s)`,
            r.totalMissed === 0 ? "Perfect" : "Partially Absent",
          ]),
          theme: "striped",
          headStyles: {
            fillColor: [26, 43, 76],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9,
            cellPadding: 3.5,
          },
          bodyStyles: {
            fontSize: 8.5,
            cellPadding: 3,
            textColor: [30, 41, 59],
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 45 },
            1: { cellWidth: 32 },
            2: { cellWidth: 32 },
            3: { halign: "center", cellWidth: 20 },
            4: { fontStyle: "bold", halign: "right", cellWidth: 28 },
            5: { fontStyle: "bold", halign: "center", cellWidth: 25 },
          },
          didParseCell: (data) => {
            if (data.section === "body") {
              if (data.column.index === 4 || data.column.index === 5) {
                const rawRow = data.row.raw as any;
                const isPerfect = Array.isArray(rawRow) ? String(rawRow[4] || "").startsWith("0") : false;
                if (isPerfect) {
                  data.cell.styles.textColor = [21, 128, 61];
                } else {
                  data.cell.styles.textColor = [185, 28, 28];
                }
              }
            }
          },
        });

        // Subject Breakdown Section
        const missedRows: any[] = [];
        rows.forEach((r) => {
          if ((r.subjectBreakdown?.length ?? 0) > 0 && r.totalMissed > 0) {
            missedRows.push([
              {
                content: `${r.memberName} (${r.year} · ${r.department}) — Total ${r.totalMissed} Missed Lecture(s)`,
                colSpan: 3,
                styles: {
                  fontStyle: "bold",
                  fillColor: [241, 245, 249],
                  textColor: [30, 41, 59],
                  fontSize: 8.5,
                },
              },
            ]);
            r.subjectBreakdown?.forEach((sub) => {
              if (sub.missed > 0) {
                missedRows.push([`   ${sub.subjectName}`, sub.facultyName || "—", `${sub.missed} lecture(s)`]);
              }
            });
          }
        });

        if (missedRows.length > 0) {
          const previousTableY = (doc as any).lastAutoTable?.finalY || currentY;

          // Section title with colored accent bar
          doc.setFillColor(15, 118, 110);
          doc.rect(14, previousTableY + 8, 3, 6, "F");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(30, 41, 59);
          doc.text("Subject Breakdown of Missed Lectures", 20, previousTableY + 13);

          autoTable(doc, {
            startY: previousTableY + 16,
            head: [["Subject Name", "Assigned Faculty", "Missed Lectures"]],
            body: missedRows,
            theme: "plain",
            styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [51, 65, 85] },
            headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold" },
            columnStyles: {
              0: { cellWidth: 90 },
              1: { cellWidth: 60 },
              2: { halign: "right", fontStyle: "bold", textColor: [185, 28, 28] },
            },
          });
        }

        // ── Date-wise Attendance Matrix ──
        // Collect unique dates from entries, sorted
        const allDates = Array.from(new Set(entries.map(e => e.date))).sort();

        if (allDates.length > 0 && members.length > 0) {
          // Build member → date → totalMissed
          const memberDateMissed = new Map<string, Map<string, number>>();
          for (const m of members) {
            memberDateMissed.set(m.id, new Map());
          }
          for (const entry of entries) {
            const mMap = memberDateMissed.get(entry.memberId);
            if (mMap) {
              mMap.set(entry.date, (mMap.get(entry.date) || 0) + entry.missed);
            }
          }

          // Format date headers as "DD\nMMM"
          const formatShort = (d: string) => {
            const dt = new Date(d + 'T00:00:00');
            const day = dt.toLocaleDateString('en-IN', { day: '2-digit' });
            const mon = dt.toLocaleDateString('en-IN', { month: 'short' });
            return `${day}\n${mon}`;
          };

          // For PDF, limit columns to fit page. Use landscape page if many dates
          const useLandscape = allDates.length > 15;

          doc.addPage(useLandscape ? "landscape" : "portrait");

          // Section header
          doc.setFillColor(26, 43, 76);
          doc.rect(0, 0, useLandscape ? 297 : 210, 14, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
          doc.text(`DATE-WISE ATTENDANCE — ${team.name}`, 14, 9);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(203, 213, 225);
          doc.text(`Period: ${startDate} to ${endDate}  |  Values = Missed Lectures (0 = Present, — = No Record)`, 14, 12.5);

          const dateHead = ["Student Name", ...allDates.map(formatShort), "Total"];

          const dateBody = members
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(m => {
              const mMap = memberDateMissed.get(m.id)!;
              let total = 0;
              const cells = allDates.map(d => {
                const missed = mMap.get(d);
                if (missed !== undefined) {
                  total += missed;
                  return String(missed);
                }
                return "—";
              });
              return [m.name, ...cells, String(total)];
            });

          autoTable(doc, {
            startY: 18,
            head: [dateHead],
            body: dateBody,
            theme: "grid",
            headStyles: {
              fillColor: [30, 58, 95],
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 6.5,
              cellPadding: 2,
              halign: "center",
              valign: "middle",
            },
            bodyStyles: {
              fontSize: 7,
              cellPadding: 1.8,
              textColor: [30, 41, 59],
              halign: "center",
            },
            columnStyles: {
              0: { halign: "left", fontStyle: "bold", cellWidth: 35 },
              [allDates.length + 1]: { fontStyle: "bold", fillColor: [248, 250, 252] },
            },
            didParseCell: (data) => {
              if (data.section === "body" && data.column.index > 0 && data.column.index <= allDates.length) {
                const val = String(data.cell.raw);
                if (val === "0") {
                  data.cell.styles.textColor = [21, 128, 61]; // green
                } else if (val !== "—" && parseInt(val) > 0) {
                  data.cell.styles.textColor = [185, 28, 28]; // red
                  data.cell.styles.fontStyle = "bold";
                } else {
                  data.cell.styles.textColor = [180, 180, 180]; // gray for no record
                }
              }
            },
          });
        }
      }

      // Footer page numbers and timestamp on every page
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(14, 283, 196, 283);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Computer Society of India · Student Chapter Attendance Portal", 14, 288);
        doc.text(`Page ${i} of ${totalPages}`, 196, 288, { align: "right" });
      }

      doc.save(`attendance-report_${dateToISTString(dateFrom)}_${dateToISTString(dateTo)}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to generate PDF report"
      );
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">
          Reports
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Generate per-subject attendance reports and export as PDF or Excel
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Select Teams</Label>
            {accessLevel !== "Admin" && userTeamId ? (
              <p className="text-sm text-muted-foreground">
                {teams.find((t) => t.id === userTeamId)?.name || "Your Team"}
                <span className="text-xs ml-2 text-muted-foreground/70">(locked to your assigned team)</span>
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
                  <Checkbox
                    checked={selectedTeamIds.size === teams.length}
                    onCheckedChange={toggleAll}
                  />
                  <span className="font-medium">All Teams</span>
                </label>
                <div className="hidden sm:block w-px h-5 bg-border self-center" />
                {teams.map((team) => (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]"
                  >
                    <Checkbox
                      checked={selectedTeamIds.has(team.id)}
                      onCheckedChange={() => toggleTeam(team.id)}
                    />
                    {team.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="flex-1 sm:flex-initial space-y-2">
                <Label>From</Label>
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-10 sm:h-8 text-sm font-medium hover:bg-muted w-full sm:w-40 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, "dd MMM yyyy")}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => {
                        if (d) { setDateFrom(d); setFromOpen(false); }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1 sm:flex-initial space-y-2">
                <Label>To</Label>
                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-10 sm:h-8 text-sm font-medium hover:bg-muted w-full sm:w-40 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, "dd MMM yyyy")}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => {
                        if (d) { setDateTo(d); setToOpen(false); }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handlePreview} disabled={previewing || reportLoading}>
              {previewing || reportLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Preview
            </Button>
            <Button
              className={`w-full sm:w-auto ${downloading ? "animate-shimmer-sweep" : ""}`}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
            <Button
              className={`w-full sm:w-auto ${exportingExcel ? "animate-shimmer-sweep" : ""}`}
              onClick={handleDownloadExcel}
              disabled={exportingExcel}
            >
              {exportingExcel ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Download Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Tables with subject breakdown */}
      {previewData.size > 0 && (
        <div className="space-y-6">
          {Array.from(previewData.entries()).map(
            ([teamId, { teamName, rows }]) => (
              <Card key={teamId}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {teamName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No data in this range
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {rows.map((row) => (
                        <div key={row.memberId} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="font-medium text-sm">{row.memberName}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {row.year} · {row.department}
                                {row.role && ` · ${row.role}`}
                              </span>
                            </div>
                            <span
                              className={`inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                row.totalMissed === 0
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {row.totalMissed} total missed
                            </span>
                          </div>

                          {row.subjectBreakdown && row.subjectBreakdown.length > 0 ? (
                            <VirtualizedTable
                              data={row.subjectBreakdown}
                              rowKey={(row, index) => index.toString()}
                              rowHeight={40}
                              height={Math.min(300, row.subjectBreakdown.length * 40 + 50)}
                              columns={[
                                {
                                  key: "subjectName",
                                  header: "Subject",
                                  cell: (sub) => <span className="text-xs">{sub.subjectName}</span>,
                                  width: 200,
                                  align: "left",
                                },
                                {
                                  key: "facultyName",
                                  header: "Faculty",
                                  cell: (sub) => <span className="text-xs text-muted-foreground">{sub.facultyName}</span>,
                                  width: 150,
                                  align: "left",
                                },
                                {
                                  key: "missed",
                                  header: "Missed",
                                  cell: (sub) => <span className="text-xs text-center font-semibold">{sub.missed}</span>,
                                  width: 80,
                                  align: "center",
                                },
                              ]}
                              emptyMessage="No subject breakdown"
                              className="rounded-lg border bg-card"
                            />
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {row.sessionsRecorded} day{row.sessionsRecorded !== 1 ? "s" : ""} recorded
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}