"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getTeams, getTeamMembers } from "@/lib/actions/roster";
import { getAttendanceByTeamAndDateRange } from "@/lib/actions/attendance";
import { dateToISTString, formatDateDisplay } from "@/lib/date-utils";
import type { Team, ReportSummaryRow } from "@/types";
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

  useEffect(() => {
    async function load() {
      try {
        const t = await getTeams();
        setTeams(t);
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

        const [members, records] = await Promise.all([
          getTeamMembers(teamId, true),
          getAttendanceByTeamAndDateRange(teamId, startDate, endDate),
        ]);

        // Build summary per member
        const memberMap = new Map<
          string,
          ReportSummaryRow & { dates: Set<string> }
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
          });
        }

        for (const record of records) {
          const entry = memberMap.get(record.memberId);
          if (entry) {
            entry.totalMissed += record.totalMissed;
            entry.dates.add(record.date);
          }
        }

        const rows = Array.from(memberMap.values()).map(
          ({ dates, ...rest }) => ({
            ...rest,
            sessionsRecorded: dates.size,
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
      const token = await user?.getIdToken();

      const res = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamIds: Array.from(selectedTeamIds),
          startDate,
          endDate,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to generate PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-report_${startDate}_${endDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download PDF"
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
          Generate attendance reports and export as PDF
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

      {/* Preview Tables */}
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
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            {rows.some((r) => r.role) && (
                              <TableHead>Role</TableHead>
                            )}
                            <TableHead>Year</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead className="text-center">
                              Total Missed
                            </TableHead>
                            <TableHead className="text-center">
                              Sessions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.memberId}>
                              <TableCell className="font-medium">
                                {row.memberName}
                              </TableCell>
                              {rows.some((r) => r.role) && (
                                <TableCell>
                                  {row.role || "—"}
                                </TableCell>
                              )}
                              <TableCell>{row.year}</TableCell>
                              <TableCell>{row.department}</TableCell>
                              <TableCell className="text-center">
                                <span
                                  className={`inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    row.totalMissed === 0
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {row.totalMissed}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                {row.sessionsRecorded}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
