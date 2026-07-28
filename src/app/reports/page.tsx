"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getTeams, getTeamMembers } from "@/lib/actions/roster";
import { getEntriesByTeam } from "@/lib/actions/attendanceEntries";
import { getCurriculums, getSubjects } from "@/lib/actions/curriculum";
import { dateToISTString } from "@/lib/date-utils";
import type { Team, ReportSummaryRow, Subject } from "@/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CalendarIcon,
  Download,
  FileText,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function ReportsContent() {
  const { user, accessLevel, teamId: userTeamId } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  // Subject lookup
  const [subjectMap, setSubjectMap] = useState<Record<string, Subject>>({});

  useEffect(() => {
    async function load() {
      try {
        const [t, curriculums] = await Promise.all([getTeams(), getCurriculums()]);
        setTeams(t);

        // Auto-select team for Head / Member
        if (accessLevel !== "Admin" && userTeamId) {
          setSelectedTeamIds(new Set([userTeamId]));
        }

        // Build subject map for display
        const sMap: Record<string, Subject> = {};
        for (const curr of curriculums) {
          const subjects = await getSubjects(curr.id);
          for (const sub of subjects) {
            sMap[sub.id] = sub;
          }
        }
        setSubjectMap(sMap);
      } catch {
        toast.error("Failed to load teams");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [accessLevel, userTeamId]);

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
      const startDate = dateToISTString(dateFrom);
      const endDate = dateToISTString(dateTo);
      const newPreview = new Map<
        string,
        { teamName: string; rows: ReportSummaryRow[] }
      >();

      for (const teamId of selectedTeamIds) {
        const team = teams.find((t) => t.id === teamId);
        if (!team) continue;

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
                facultyName: subjectMap[subId]?.facultyName || "—",
                missed,
              })
            ),
          })
        );

        newPreview.set(teamId, { teamName: team.name, rows });
      }

      setPreviewData(newPreview);
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setPreviewing(false);
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
          Generate per-subject attendance reports and export as PDF
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
            <Button variant="outline" className="w-full sm:w-auto" onClick={handlePreview} disabled={previewing}>
              {previewing ? (
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
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Subject</TableHead>
                                    <TableHead className="text-xs">Faculty</TableHead>
                                    <TableHead className="text-xs text-center">Missed</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {row.subjectBreakdown.map((sub, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-xs">{sub.subjectName}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{sub.facultyName}</TableCell>
                                      <TableCell className="text-xs text-center font-semibold">
                                        {sub.missed}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
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
