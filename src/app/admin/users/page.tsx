"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminRoute } from "@/components/AdminRoute";
import type { AuthorizedUser, AccessLevel, Team } from "@/types";
import {
  getAuthorizedUsers,
  addAuthorizedUser,
  updateAuthorizedUser,
  removeAuthorizedUser,
} from "@/lib/actions/users";
import { getTeams } from "@/lib/actions/roster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Trash2, ShieldCheck, Shield, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";

type FilterTab = "All" | AccessLevel;

function RoleBadge({ level }: { level?: AccessLevel }) {
  if (level === "Admin") {
    return (
      <Badge className="gap-1">
        <ShieldCheck className="h-3 w-3" />
        Admin
      </Badge>
    );
  }
  if (level === "Head's Access") {
    return (
      <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10">
        <UserCheck className="h-3 w-3" />
        Head&apos;s Access
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Shield className="h-3 w-3" />
      Member&apos;s Access
    </Badge>
  );
}

function AdminUsersContent() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuthorizedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newAccessLevel, setNewAccessLevel] = useState<AccessLevel>("Member's Access");
  const [newTeamId, setNewTeamId] = useState("");
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [usersData, teamsData] = await Promise.all([
        getAuthorizedUsers(),
        getTeams(),
      ]);
      setUsers(usersData);
      setTeams(teamsData);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Team name lookup
  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  const handleAdd = async () => {
    if (!newEmail.trim() || !newName.trim()) return;

    // Require team for Head / Member
    if (newAccessLevel !== "Admin" && !newTeamId) {
      toast.error("Please select a team for this user");
      return;
    }

    setAdding(true);
    try {
      await addAuthorizedUser(
        newEmail.trim().toLowerCase(),
        newName.trim(),
        newAccessLevel,
        newAccessLevel !== "Admin" ? newTeamId : undefined
      );

      toast.success(`${newName.trim()} added`);
      setAddDialogOpen(false);
      setNewEmail("");
      setNewName("");
      setNewAccessLevel("Member's Access");
      setNewTeamId("");
      await loadData();
    } catch {
      toast.error("Failed to add user");
    } finally {
      setAdding(false);
    }
  };

  const handleAccessLevelChange = async (targetUser: AuthorizedUser, level: AccessLevel) => {
    try {
      const updatePayload: Parameters<typeof updateAuthorizedUser>[1] = {
        accessLevel: level,
      };
      // Clear teamId when promoting to Admin
      if (level === "Admin") {
        updatePayload.teamId = null;
      }
      await updateAuthorizedUser(targetUser.email, updatePayload);

      toast.success(`${targetUser.name}'s permission updated to ${level}`);
      await loadData();
    } catch {
      toast.error("Failed to update user permission");
    }
  };

  const handleTeamChange = async (targetUser: AuthorizedUser, teamId: string) => {
    try {
      await updateAuthorizedUser(targetUser.email, { teamId });
      toast.success(`${targetUser.name}'s team updated`);
      await loadData();
    } catch {
      toast.error("Failed to update team");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.email === user?.email) {
      toast.error("Cannot remove your own account");
      return;
    }

    setDeleting(true);
    try {
      await removeAuthorizedUser(deleteTarget.email);
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove user");
    } finally {
      setDeleting(false);
    }
  };

  // Counts
  const countAll = users.length;
  const countAdmin = users.filter((u) => (u.accessLevel || (u.isAdmin ? "Admin" : "Member's Access")) === "Admin").length;
  const countHead = users.filter((u) => (u.accessLevel || (u.isAdmin ? "Admin" : "Member's Access")) === "Head's Access").length;
  const countMember = users.filter((u) => (u.accessLevel || (u.isAdmin ? "Admin" : "Member's Access")) === "Member's Access").length;

  const filteredUsers = users.filter((u) => {
    if (activeTab === "All") return true;
    const currentLevel = u.accessLevel || (u.isAdmin ? "Admin" : "Member's Access");
    return currentLevel === activeTab;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">
            Manage Users
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Control who can access the attendance tracker and set permissions
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Access Level Navbar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-muted/50 dark:bg-muted/30 rounded-xl border border-border/60 w-fit">
        <button
          onClick={() => setActiveTab("All")}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none",
            activeTab === "All"
              ? "bg-background text-foreground shadow-sm dark:bg-card font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          <span>All Users</span>
          <Badge variant={activeTab === "All" ? "default" : "secondary"} className="px-1.5 py-0 text-[10px] h-4 min-w-4 flex items-center justify-center rounded-full">{countAll}</Badge>
        </button>
        <button
          onClick={() => setActiveTab("Admin")}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none",
            activeTab === "Admin"
              ? "bg-background text-foreground shadow-sm dark:bg-card font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
          <span>Admin</span>
          <Badge variant={activeTab === "Admin" ? "default" : "secondary"} className="px-1.5 py-0 text-[10px] h-4 min-w-4 flex items-center justify-center rounded-full">{countAdmin}</Badge>
        </button>
        <button
          onClick={() => setActiveTab("Head's Access")}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none",
            activeTab === "Head's Access"
              ? "bg-background text-foreground shadow-sm dark:bg-card font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <UserCheck className="h-3.5 w-3.5 text-blue-500" />
          <span>Head&apos;s Access</span>
          <Badge variant={activeTab === "Head's Access" ? "default" : "secondary"} className="px-1.5 py-0 text-[10px] h-4 min-w-4 flex items-center justify-center rounded-full">{countHead}</Badge>
        </button>
        <button
          onClick={() => setActiveTab("Member's Access")}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none",
            activeTab === "Member's Access"
              ? "bg-background text-foreground shadow-sm dark:bg-card font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          <span>Member&apos;s Access</span>
          <Badge variant={activeTab === "Member's Access" ? "default" : "secondary"} className="px-1.5 py-0 text-[10px] h-4 min-w-4 flex items-center justify-center rounded-full">{countMember}</Badge>
        </button>
      </div>

      <div className="rounded-lg border bg-card">
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">Team</TableHead>
                <TableHead className="text-center">Access Level</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    No users found for {activeTab === "All" ? "this group" : activeTab}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const currentAccess: AccessLevel = u.accessLevel || (u.isAdmin ? "Admin" : "Member's Access");
                  const isSelf = u.email === user?.email;

                  return (
                    <TableRow key={u.email}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                      <TableCell className="text-center">
                        <RoleBadge level={currentAccess} />
                      </TableCell>
                      <TableCell className="text-center">
                        {currentAccess === "Admin" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Select
                            value={u.teamId || ""}
                            onValueChange={(val) => val && handleTeamChange(u, val)}
                            disabled={isSelf}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs mx-auto">
                              <SelectValue placeholder="Select team">
                                {teamNameMap.get(u.teamId || "")}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {teams.map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={currentAccess}
                          onValueChange={(val) => val && handleAccessLevelChange(u, val as AccessLevel)}
                          disabled={isSelf}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs mx-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Head's Access">Head&apos;s Access</SelectItem>
                            <SelectItem value="Member's Access">Member&apos;s Access</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(u)} disabled={isSelf}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y">
          {filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              No users found for {activeTab === "All" ? "this group" : activeTab}.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const currentAccess: AccessLevel = u.accessLevel || (u.isAdmin ? "Admin" : "Member's Access");
              const isSelf = u.email === user?.email;

              return (
                <div key={u.email} className="flex flex-col gap-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium text-sm truncate">{u.name}</span>
                      <RoleBadge level={currentAccess} />
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setDeleteTarget(u)} disabled={isSelf}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.teamId && (
                    <p className="text-xs text-muted-foreground">
                      Team: <span className="font-medium text-foreground">{teamNameMap.get(u.teamId) || u.teamId}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground shrink-0">Access:</span>
                    <Select
                      value={currentAccess}
                      onValueChange={(val) => val && handleAccessLevelChange(u, val as AccessLevel)}
                      disabled={isSelf}
                    >
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Head's Access">Head&apos;s Access</SelectItem>
                        <SelectItem value="Member's Access">Member&apos;s Access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {currentAccess !== "Admin" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Team:</span>
                      <Select
                        value={u.teamId || ""}
                        onValueChange={(val) => val && handleTeamChange(u, val)}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Select team">
                            {teamNameMap.get(u.teamId || "")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:w-full">
          <DialogHeader>
            <DialogTitle>Add Authorized User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input id="user-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@gmail.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-name">Name *</Label>
              <Input id="user-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-access">Access Level *</Label>
              <Select
                value={newAccessLevel}
                onValueChange={(val) => {
                  if (val) {
                    setNewAccessLevel(val as AccessLevel);
                    if (val === "Admin") setNewTeamId("");
                  }
                }}
              >
                <SelectTrigger id="user-access" className="w-full">
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Head's Access">Head&apos;s Access</SelectItem>
                  <SelectItem value="Member's Access">Member&apos;s Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newAccessLevel !== "Admin" && (
              <div className="space-y-2">
                <Label htmlFor="user-team">Assigned Team *</Label>
                <Select value={newTeamId} onValueChange={(val) => val && setNewTeamId(val)}>
                  <SelectTrigger id="user-team" className="w-full">
                    <SelectValue placeholder="Select team">
                      {teamNameMap.get(newTeamId)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              disabled={adding || !newEmail.trim() || !newName.trim() || (newAccessLevel !== "Admin" && !newTeamId)}
            >
              {adding ? "Adding..." : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) from the authorized users list? They will no longer be able to access the attendance tracker.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminRoute>
      <AdminUsersContent />
    </AdminRoute>
  );
}
