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
  const { user } = useAuth();
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
  }, []);

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

        // Render PDF header for team
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(45, 55, 72);
        doc.text("CSI Attendance Report", 14, 20);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(100, 110, 125);
        doc.text(`Team: ${team.name}   |   Period: ${startDate} to ${endDate}`, 14, 28);

        const startY = 35;

        if (rows.length === 0) {
          doc.setFontSize(12);
          doc.text("No member data recorded in this range.", 14, startY);
          continue;
        }

        autoTable(doc, {
          startY: startY,
          head: [["Name", "Year / Dept", "Role", "Sessions", "Total Missed"]],
          body: rows.map((r) => [
            r.memberName,
            `${r.year} - ${r.department}`,
            r.role || "Member",
            String(r.sessionsRecorded),
            `${r.totalMissed} lecture(s)`,
          ]),
          styles: { fontSize: 10, cellPadding: 4, textColor: [45, 55, 72] },
          headStyles: { fillColor: [74, 85, 104], textColor: 255, fontStyle: "bold" },
          columnStyles: {
            4: { fontStyle: "bold", halign: "right" },
          },
        });

        const missedRows: any[] = [];
        rows.forEach((r) => {
          if ((r.subjectBreakdown?.length ?? 0) > 0 && r.totalMissed > 0) {
            missedRows.push([
              {
                content: `${r.memberName} (${r.year}-${r.department}) — ${r.totalMissed} total missed`,
                colSpan: 3,
                styles: { fontStyle: "bold", fillColor: [238, 242, 246], textColor: [45, 55, 72] },
              },
            ]);
            r.subjectBreakdown?.forEach((sub) => {
              if (sub.missed > 0) {
                missedRows.push([`   ${sub.subjectName}`, sub.facultyName || "—", `${sub.missed} period(s)`]);
              }
            });
          }
        });

        if (missedRows.length > 0) {
          const previousTableY = (doc as any).lastAutoTable?.finalY || startY;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(45, 55, 72);
          doc.text("Subject Breakdown of Missed Lectures", 14, previousTableY + 14);

          autoTable(doc, {
            startY: previousTableY + 18,
            head: [["Subject", "Faculty", "Missed Count"]],
            body: missedRows,
            styles: { fontSize: 9, cellPadding: 3, textColor: [45, 55, 72] },
            headStyles: { fillColor: [113, 128, 150], textColor: 255 },
            columnStyles: {
              2: { halign: "right", fontStyle: "bold" },
            },
          });
        }
      }

      // Footer page numbers and timestamp
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("CSI Committee Attendance Report", 14, doc.internal.pageSize.height - 10);
        doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width - 28, doc.internal.pageSize.height - 10);
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
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate per-subject attendance reports and export as PDF
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Team Selection */}
          <div className="space-y-3">
            <Label>Select Teams</Label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedTeamIds.size === teams.length}
                  onCheckedChange={toggleAll}
                />
                <span className="font-medium">All Teams</span>
              </label>
              <div className="w-px h-5 bg-border self-center" />
              {teams.map((team) => (
                <label
                  key={team.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTeamIds.has(team.id)}
                    onCheckedChange={() => toggleTeam(team.id)}
                  />
                  {team.name}
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium hover:bg-muted w-40 justify-start text-left font-normal">
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

            <div className="space-y-2">
              <Label>To</Label>
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium hover:bg-muted w-40 justify-start text-left font-normal">
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

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handlePreview} disabled={previewing}>
              {previewing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Preview
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
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
