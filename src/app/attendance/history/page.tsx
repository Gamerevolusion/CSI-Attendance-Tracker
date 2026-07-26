"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getTeams, getTeamMembers } from "@/lib/actions/roster";
import {
  getAttendanceByTeamAndDateRange,
  deleteAttendanceRecord,
} from "@/lib/actions/attendance";
import {
  formatDateDisplay,
  dateToISTString,
} from "@/lib/date-utils";
import type { Team, Member, AttendanceRecord } from "@/types";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarIcon, Trash2, ArrowUpDown, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function HistoryContent() {
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [sortAsc, setSortAsc] = useState(false);

  // Date range
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1); // Start of month
    return d;
  });
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load teams
  useEffect(() => {
    async function load() {
      try {
        const t = await getTeams();
        setTeams(t);
        if (t.length > 0) setSelectedTeam(t[0].id);
      } catch {
        toast.error("Failed to load teams");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load members when team changes
  useEffect(() => {
    if (!selectedTeam) return;
    async function loadMembers() {
      try {
        const m = await getTeamMembers(selectedTeam, true);
        setMembers(m);
      } catch {
        // ignore
      }
    }
    loadMembers();
  }, [selectedTeam]);

  // Refresh trigger — increment to force a reload
  const [refreshKey, setRefreshKey] = useState(0);
  const loadRecords = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Load attendance records
  useEffect(() => {
    if (!selectedTeam) return;
    let cancelled = false;

    async function fetchRecords() {
      setDataLoading(true);
      try {
        const startDate = dateToISTString(dateFrom);
        const endDate = dateToISTString(dateTo);
        const data = await getAttendanceByTeamAndDateRange(
          selectedTeam,
          startDate,
          endDate
        );
        if (!cancelled) setRecords(data);
      } catch {
        if (!cancelled) toast.error("Failed to load attendance history");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    fetchRecords();
    return () => { cancelled = true; };
  }, [selectedTeam, dateFrom, dateTo, refreshKey]);

  // Filter & sort
  let filtered = records;
  if (selectedMember !== "all") {
    filtered = filtered.filter((r) => r.memberId === selectedMember);
  }
  filtered = [...filtered].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return sortAsc ? cmp : -cmp;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAttendanceRecord(deleteTarget.id);
      toast.success("Record deleted");
      setDeleteTarget(null);
      await loadRecords();
    } catch {
      toast.error("Failed to delete record");
    } finally {
      setDeleting(false);
    }
  };

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
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">
          Attendance History
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          View and manage past attendance records
        </p>
      </div>

      {/* Team Tabs Strip */}
      <div className="neo-pressed p-1.5 rounded-2xl">
        <div className="neo-scroll-x flex gap-1.5 p-1">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm whitespace-nowrap font-medium transition-all duration-150 shrink-0 ${
                selectedTeam === team.id
                  ? "neo-raised font-bold text-foreground"
                  : "text-muted-foreground hover:text-foreground opacity-80"
              }`}
              onClick={() => {
                setSelectedTeam(team.id);
                setSelectedMember("all");
              }}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
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
                  onSelect={(d) => { if (d) { setDateFrom(d); setFromOpen(false); } }}
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
                  onSelect={(d) => { if (d) { setDateTo(d); setToOpen(false); } }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2 w-full sm:w-auto">
          <Label>Member</Label>
          <Select value={selectedMember} onValueChange={(val) => val && setSelectedMember(val)}>
            <SelectTrigger className="w-full sm:w-44 h-10 sm:h-8">
              <SelectValue placeholder="All members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Records Table */}
      <div className="rounded-lg border bg-card">
        {dataLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No attendance records found for this period
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => setSortAsc(!sortAsc)}
                      >
                        Date
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-center">Lectures Missed</TableHead>
                    <TableHead>Marked By</TableHead>
                    {isAdmin && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {formatDateDisplay(record.date)}
                      </TableCell>
                      <TableCell>{record.memberName}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            record.totalMissed === 0
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : record.totalMissed >= 3
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}
                        >
                          {record.totalMissed} / {record.lectureCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {record.markedBy}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(record)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y">
              {filtered.map((record) => (
                <div key={record.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{record.memberName}</span>
                      <span
                        className={`inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          record.totalMissed === 0
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : record.totalMissed >= 3
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {record.totalMissed}/{record.lectureCount}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateDisplay(record.date)} · by {record.markedBy}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 shrink-0"
                      onClick={() => setDeleteTarget(record)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attendance Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete the attendance record for{" "}
            <strong>{deleteTarget?.memberName}</strong> on{" "}
            <strong>
              {deleteTarget ? formatDateDisplay(deleteTarget.date) : ""}
            </strong>
            ? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AttendanceHistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryContent />
    </ProtectedRoute>
  );
}
