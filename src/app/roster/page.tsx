"use client";

import { useState, useEffect } from "react";

import type { Team, Member, MemberFormData } from "@/types";
import { getTeams, getTeamMembers, addMember, updateMember, toggleMemberActive } from "@/lib/actions/roster";
import { AdminRoute } from "@/components/AdminRoute";
import { MemberForm } from "@/components/roster/MemberForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dialog";
import { Plus, Pencil, UserX, UserCheck, Users } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Team Roster
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage committee members across all teams
          </p>
        </div>
      </div>

      <Tabs value={selectedTeam} onValueChange={setSelectedTeam}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="inline-flex w-max">
            {teams.map((team) => (
              <TabsTrigger key={team.id} value={team.id} className="text-xs sm:text-sm whitespace-nowrap">
                {team.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {teams.map((team) => (
          <TabsContent key={team.id} value={team.id}>
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => setShowInactive(!showInactive)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {showInactive ? "Hide inactive" : "Show inactive"}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingMember(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Member
                </Button>
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
                <div className="overflow-x-auto">
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
                                onClick={() => handleToggleActive(member)}
                              >
                                {member.active !== false ? (
                                  <UserX className="h-3.5 w-3.5 text-destructive" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5 text-green-600" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMember(null);
        }}
      >
        <DialogContent>
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
