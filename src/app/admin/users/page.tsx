"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminRoute } from "@/components/AdminRoute";
import type { AuthorizedUser, AccessLevel } from "@/types";
import {
  getAuthorizedUsers,
  addAuthorizedUser,
  updateAuthorizedUser,
  removeAuthorizedUser,
} from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Trash2, ShieldCheck, Shield, UserCheck } from "lucide-react";
import { toast } from "sonner";

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
        Head's Access
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Shield className="h-3 w-3" />
      Member's Access
    </Badge>
  );
}

function AdminUsersContent() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuthorizedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newAccessLevel, setNewAccessLevel] = useState<AccessLevel>("Member's Access");
  const [adding, setAdding] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await getAuthorizedUsers();
      setUsers(data);
    } catch {
      toast.error("Failed to load authorized users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAdd = async () => {
    if (!newEmail.trim() || !newName.trim()) return;

    setAdding(true);
    try {
      await addAuthorizedUser(
        newEmail.trim().toLowerCase(),
        newName.trim(),
        newAccessLevel
      );

      toast.success(`${newName.trim()} added`);
      setAddDialogOpen(false);
      setNewEmail("");
      setNewName("");
      setNewAccessLevel("Member's Access");
      await loadUsers();
    } catch {
      toast.error("Failed to add user");
    } finally {
      setAdding(false);
    }
  };

  const handleAccessLevelChange = async (targetUser: AuthorizedUser, level: AccessLevel) => {
    try {
      await updateAuthorizedUser(targetUser.email, {
        accessLevel: level,
      });

      toast.success(`${targetUser.name}'s permission updated to ${level}`);
      await loadUsers();
    } catch {
      toast.error("Failed to update user permission");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    // Prevent self-removal
    if (deleteTarget.email === user?.email) {
      toast.error("Cannot remove your own account");
      return;
    }

    setDeleting(true);
    try {
      await removeAuthorizedUser(deleteTarget.email);

      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove user"
      );
    } finally {
      setDeleting(false);
    }
  };

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

      <div className="rounded-lg border bg-card">
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">Permission / Access Level</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const currentAccess: AccessLevel = u.accessLevel || (u.isAdmin ? "Admin" : "Member's Access");
                const isSelf = u.email === user?.email;

                return (
                  <TableRow key={u.email}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-center">
                      <RoleBadge level={currentAccess} />
                    </TableCell>
                    <TableCell className="text-center flex justify-center py-2">
                      <Select
                        value={currentAccess}
                        onValueChange={(val) => val && handleAccessLevelChange(u, val as AccessLevel)}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Head's Access">Head's Access</SelectItem>
                          <SelectItem value="Member's Access">Member's Access</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(u)}
                        disabled={isSelf}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y">
          {users.map((u) => {
            const currentAccess: AccessLevel = u.accessLevel || (u.isAdmin ? "Admin" : "Member's Access");
            const isSelf = u.email === user?.email;

            return (
              <div key={u.email} className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-medium text-sm truncate">{u.name}</span>
                    <RoleBadge level={currentAccess} />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => setDeleteTarget(u)}
                    disabled={isSelf}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {u.email}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">Access:</span>
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
                      <SelectItem value="Head's Access">Head's Access</SelectItem>
                      <SelectItem value="Member's Access">Member's Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
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
              <Input
                id="user-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-name">Name *</Label>
              <Input
                id="user-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-access">Access Level *</Label>
              <Select
                value={newAccessLevel}
                onValueChange={(val) => val && setNewAccessLevel(val as AccessLevel)}
              >
                <SelectTrigger id="user-access" className="w-full">
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Head's Access">Head's Access</SelectItem>
                  <SelectItem value="Member's Access">Member's Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={adding || !newEmail.trim() || !newName.trim()}
            >
              {adding ? "Adding..." : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTarget?.name}</strong> (
            {deleteTarget?.email}) from the authorized users list? They will
            no longer be able to access the attendance tracker.
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
