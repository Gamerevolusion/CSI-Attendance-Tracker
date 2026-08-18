"use client";

import { useState, useEffect } from "react";
import { useAuthUser, useAuthPermissions } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getTeamMembers } from "@/lib/actions/roster";
import { getEntriesByTeam } from "@/lib/actions/attendanceEntries";
import { dateToISTString } from "@/lib/date-utils";
import type { Team, ReportSummaryRow, Subject } from "@/types";
import { useTeams, useCurriculums, useSubjectMap, useReportData } from "@/lib/hooks/useReports";
import * as XLSX from 'xlsx';
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

  // Excel export helper
  const generateExcelData = async () => {
    const workbook = XLSX.utils.book_new();
    const startDate = dateToISTString(dateFrom);
    const endDate = dateToISTString(dateTo);

    // Summary sheet
    const summaryData: (string | number)[][] = [
      ['CSI Attendance Report'],
      [`Period: ${startDate} to ${endDate}`],
      [`Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`],
      [],
      ['Team', 'Member Name', 'Year', 'Department', 'Role', 'Sessions Recorded', 'Total Missed Lectures', 'Status'],
    ];

    // Subject breakdown sheets data
    const subjectBreakdownData: Record<string, (string | number)[][]> = {};

    Array.from(previewData.entries()).forEach(([teamId, { teamName, rows }]) => {
      rows.forEach((row) => {
        const status = row.totalMissed === 0 ? 'Perfect Attendance' : 'Partially Absent';
        summaryData.push([
          teamName,
          row.memberName,
          row.year,
          row.department,
          row.role || 'Member',
          row.sessionsRecorded,
          row.totalMissed,
          status,
        ]);

        // Collect subject breakdown data
        if (row.subjectBreakdown && row.subjectBreakdown.length > 0) {
          if (!subjectBreakdownData[teamName]) {
            subjectBreakdownData[teamName] = [
              ['Subject Breakdown: ' + teamName],
              [`Period: ${startDate} to ${endDate}`],
              [],
              ['Member Name', 'Subject', 'Faculty', 'Missed Lectures'],
            ];
          }
          row.subjectBreakdown.forEach((sub) => {
            if (sub.missed > 0) {
              subjectBreakdownData[teamName].push([
                row.memberName,
                sub.subjectName,
                sub.facultyName || '—',
                sub.missed,
              ]);
            }
          });
        }
      });
    });

    // Add summary sheet
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [
      { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 15 },
      { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // ── Date-wise Attendance Matrix per team ──
    for (const teamId of selectedTeamIds) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) continue;

      // Fetch raw entries for this team
      const [members, entries] = await Promise.all([
        getTeamMembers(teamId, true),
        getEntriesByTeam(teamId, startDate, endDate),
      ]);

      if (members.length === 0) continue;

      // Collect all unique dates from entries, sorted
      const allDates = Array.from(new Set(entries.map(e => e.date))).sort();
      if (allDates.length === 0) continue;

      // Build member → date → { totalMissed, subjectDetails }
      const memberDateMap = new Map<string, {
        name: string;
        year: string;
        dept: string;
        dates: Map<string, { total: number; subjects: string[] }>;
      }>();

      for (const m of members) {
        memberDateMap.set(m.id, {
          name: m.name,
          year: m.year,
          dept: m.department,
          dates: new Map(),
        });
      }

      for (const entry of entries) {
        const member = memberDateMap.get(entry.memberId);
        if (!member) continue;
        const existing = member.dates.get(entry.date);
        const subName = subjectMap[entry.subjectId]?.subjectName || entry.subjectId;
        if (existing) {
          existing.total += entry.missed;
          if (entry.missed > 0) existing.subjects.push(`${subName}(${entry.missed})`);
        } else {
          member.dates.set(entry.date, {
            total: entry.missed,
            subjects: entry.missed > 0 ? [`${subName}(${entry.missed})`] : [],
          });
        }
      }

      // Format date headers as "DD MMM"
      const formatShort = (d: string) => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      };

      // Build date-wise sheet: Student Name | Year | Dept | Date1 | Date2 | ... | Total
      const dateHeaders = allDates.map(formatShort);
      const headerRow: (string | number)[] = ['Student Name', 'Year', 'Dept', ...dateHeaders, 'Total Missed'];

      const dateSheetData: (string | number)[][] = [
        [`Date-wise Attendance: ${team.name}`],
        [`Period: ${startDate} to ${endDate}`],
        [`Values show missed lectures per day (0 = present, blank = no record)`],
        [],
        headerRow,
      ];

      const sortedMembers = Array.from(memberDateMap.values())
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const member of sortedMembers) {
        let totalMissed = 0;
        const row: (string | number)[] = [member.name, member.year, member.dept];
        for (const date of allDates) {
          const dayData = member.dates.get(date);
          if (dayData) {
            row.push(dayData.total);
            totalMissed += dayData.total;
          } else {
            row.push('');
          }
        }
        row.push(totalMissed);
        dateSheetData.push(row);
      }

      const dateSheet = XLSX.utils.aoa_to_sheet(dateSheetData);
      // Set column widths
      const dateCols = [
        { wch: 25 }, // Name
        { wch: 8 },  // Year
        { wch: 8 },  // Dept
        ...allDates.map(() => ({ wch: 8 })),
        { wch: 12 }, // Total
      ];
      dateSheet['!cols'] = dateCols;

      const safeSheetName = `${team.name} Daily`.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      XLSX.utils.book_append_sheet(workbook, dateSheet, safeSheetName);
    }

    // Add subject breakdown sheets
    Object.entries(subjectBreakdownData).forEach(([teamName, data]) => {
      const sheet = XLSX.utils.aoa_to_sheet(data);
      sheet['!cols'] = [
        { wch: 25 }, { wch: 40 }, { wch: 25 }, { wch: 18 },
      ];
      const safeSheetName = `${teamName} Subjects`.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName);
    });

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
      XLSX.writeFile(workbook, fileName);
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