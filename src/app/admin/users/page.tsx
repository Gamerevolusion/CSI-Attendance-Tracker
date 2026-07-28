"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminRoute } from "@/components/AdminRoute";
import type { AuthorizedUser } from "@/types";
import {
  getAuthorizedUsers,
  addAuthorizedUser,
  updateAuthorizedUser,
  removeAuthorizedUser,
} from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Trash2, ShieldCheck, Shield } from "lucide-react";
import { toast } from "sonner";

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
  const [newIsAdmin, setNewIsAdmin] = useState(false);
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
        newIsAdmin
      );

      toast.success(`${newName.trim()} added`);
      setAddDialogOpen(false);
      setNewEmail("");
      setNewName("");
      setNewIsAdmin(false);
      await loadUsers();
    } catch {
      toast.error("Failed to add user");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleAdmin = async (targetUser: AuthorizedUser) => {
    try {
      await updateAuthorizedUser(targetUser.email, {
        isAdmin: !targetUser.isAdmin,
      });

      toast.success(
        `${targetUser.name} ${!targetUser.isAdmin ? "promoted to" : "removed from"} admin`
      );
      await loadUsers();
    } catch {
      toast.error("Failed to update user");
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
            Control who can access the attendance tracker
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
                <TableHead className="text-center">Admin</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.email}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.email}
                  </TableCell>
                  <TableCell className="text-center">
                    {u.isAdmin ? (
                      <Badge className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Member
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={u.isAdmin}
                      onCheckedChange={() => handleToggleAdmin(u)}
                      disabled={u.email === user?.email}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(u)}
                      disabled={u.email === user?.email}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y">
          {users.map((u) => (
            <div key={u.email} className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{u.name}</span>
                  {u.isAdmin ? (
                    <Badge className="gap-1 text-[10px] px-1.5 py-0">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Admin
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                      <Shield className="h-2.5 w-2.5" />
                      Member
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {u.email}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={u.isAdmin}
                  onCheckedChange={() => handleToggleAdmin(u)}
                  disabled={u.email === user?.email}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => setDeleteTarget(u)}
                  disabled={u.email === user?.email}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
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
            <div className="flex items-center gap-3">
              <Switch
                id="user-admin"
                checked={newIsAdmin}
                onCheckedChange={setNewIsAdmin}
              />
              <Label htmlFor="user-admin">Grant admin privileges</Label>
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
