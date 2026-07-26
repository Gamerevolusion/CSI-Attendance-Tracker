"use client";

import { useState, useEffect } from "react";

import type { Team, Member, MemberFormData } from "@/types";
import { getTeams, getTeamMembers, addMember, updateMember, toggleMemberActive, deleteMember } from "@/lib/actions/roster";
import { AdminRoute } from "@/components/AdminRoute";
import { MemberForm } from "@/components/roster/MemberForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, UserX, UserCheck, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

function RosterContent() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
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
      setMembersLoading(true);
      try {
        const m = await getTeamMembers(selectedTeam, true);
        setMembers(m);
      } catch {
        toast.error("Failed to load members");
      } finally {
        setMembersLoading(false);
      }
    }
    loadMembers();
  }, [selectedTeam]);

  const currentTeam = teams.find((t) => t.id === selectedTeam);
  const filteredMembers = showInactive
    ? members
    : members.filter((m) => m.active !== false);

  const handleAddMember = async (data: MemberFormData) => {
    try {
      await addMember(selectedTeam, data);
      toast.success(`${data.name} added to ${currentTeam?.name}`);
      setDialogOpen(false);
      // Reload members
      const m = await getTeamMembers(selectedTeam, true);
      setMembers(m);
    } catch {
      toast.error("Failed to add member");
    }
  };

  const handleEditMember = async (data: MemberFormData) => {
    if (!editingMember) return;
    try {
      await updateMember(selectedTeam, editingMember.id, data);
      toast.success(`${data.name} updated`);
      setEditingMember(null);
      setDialogOpen(false);
      const m = await getTeamMembers(selectedTeam, true);
      setMembers(m);
    } catch {
      toast.error("Failed to update member");
    }
  };

  const handleToggleActive = async (member: Member) => {
    const newActive = !member.active;
    try {
      await toggleMemberActive(selectedTeam, member.id, newActive);
      toast.success(
        newActive
          ? `${member.name} reactivated`
          : `${member.name} deactivated`
      );
      const m = await getTeamMembers(selectedTeam, true);
      setMembers(m);
    } catch {
      toast.error("Failed to update member status");
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMember(selectedTeam, deleteTarget.id);
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      const m = await getTeamMembers(selectedTeam, true);
      setMembers(m);
    } catch {
      toast.error("Failed to delete member");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">
            Team Roster
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage committee members across all teams
          </p>
        </div>
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => {
            setEditingMember(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
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
              onClick={() => setSelectedTeam(team.id)}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      {/* Current Team Roster Card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold">
              {currentTeam?.name || "Team"} Roster ({filteredMembers.length})
            </span>
            <span className="text-muted-foreground text-xs">•</span>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="text-xs text-muted-foreground hover:text-foreground underline font-medium"
            >
              {showInactive ? "Hide inactive" : "Show inactive"}
            </button>
          </div>
        </div>

              {membersLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No members in this team yet
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setEditingMember(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Member
                  </Button>
                </div>
              ) : (
                <div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          {currentTeam?.hasRoleField && (
                            <TableHead>Role</TableHead>
                          )}
                          <TableHead>Year</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMembers.map((member) => (
                          <TableRow
                            key={member.id}
                            className={
                              member.active === false ? "opacity-50" : ""
                            }
                          >
                            <TableCell className="font-medium">
                              {member.name}
                            </TableCell>
                            {currentTeam?.hasRoleField && (
                              <TableCell>
                                {member.role || (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell>{member.year}</TableCell>
                            <TableCell>{member.department}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  member.active !== false
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {member.active !== false
                                  ? "Active"
                                  : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Edit member"
                                  onClick={() => {
                                    setEditingMember(member);
                                    setDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={member.active !== false ? "Deactivate member" : "Reactivate member"}
                                  onClick={() => handleToggleActive(member)}
                                >
                                  {member.active !== false ? (
                                    <UserX className="h-3.5 w-3.5 text-amber-600" />
                                  ) : (
                                    <UserCheck className="h-3.5 w-3.5 text-green-600" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Delete member"
                                  onClick={() => setDeleteTarget(member)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className={`flex items-center gap-3 p-3 ${
                          member.active === false ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{member.name}</span>
                            <Badge
                              variant={
                                member.active !== false ? "default" : "secondary"
                              }
                              className="text-[10px] px-1.5 py-0"
                            >
                              {member.active !== false ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {member.year} · {member.department}
                            {currentTeam?.hasRoleField && member.role ? ` · ${member.role}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0"
                            title="Edit"
                            onClick={() => {
                              setEditingMember(member);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0"
                            title={member.active !== false ? "Deactivate" : "Reactivate"}
                            onClick={() => handleToggleActive(member)}
                          >
                            {member.active !== false ? (
                              <UserX className="h-4 w-4 text-amber-600" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0"
                            title="Delete"
                            onClick={() => setDeleteTarget(member)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMember(null);
        }}
      >
        <DialogContent className="w-[95vw] max-w-lg sm:w-full">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Edit Member" : "Add Member"}
            </DialogTitle>
          </DialogHeader>
          <MemberForm
            hasRoleField={currentTeam?.hasRoleField ?? true}
            initialData={
              editingMember
                ? {
                    name: editingMember.name,
                    role: editingMember.role || "",
                    year: editingMember.year,
                    department: editingMember.department,
                  }
                : undefined
            }
            onSubmit={editingMember ? handleEditMember : handleAddMember}
            onCancel={() => {
              setDialogOpen(false);
              setEditingMember(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="w-[95vw] max-w-lg sm:w-full">
          <DialogHeader>
            <DialogTitle>Delete Member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong>{deleteTarget?.name}</strong> from{" "}
            <strong>{currentTeam?.name}</strong>? This will also clean up their attendance history and cannot be undone.
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
              onClick={handleDeleteMember}
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

export default function RosterPage() {
  return (
    <AdminRoute>
      <RosterContent />
    </AdminRoute>
  );
}
