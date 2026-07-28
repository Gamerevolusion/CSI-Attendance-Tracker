"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getTeam } from "@/lib/actions/roster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Loader2, User, ShieldCheck, Shield, UserCheck, Mail } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  "Chairperson",
  "Vice-Chairperson",
  "Secretary",
  "Joint Secretary",
  "Treasurer",
  "Technical Head",
  "Event Head",
  "PR Head",
  "Social Media Head",
  "Design Head",
  "Logistics Head",
  "Core Member",
  "Team Lead",
  "Co-Head",
  "Member",
  "Volunteer",
];

function ProfileContent() {
  const { user, accessLevel, teamId: userTeamId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [useCustomRole, setUseCustomRole] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    async function load() {
      try {
        const docRef = doc(db, "authorizedUsers", user!.email!);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || user!.displayName || "");
          setIsAdmin(data.isAdmin || false);

          const savedRole = data.role || "";
          if (savedRole && !ROLE_OPTIONS.includes(savedRole)) {
            setUseCustomRole(true);
            setCustomRole(savedRole);
            setRole("");
          } else {
            setRole(savedRole);
          }
        }

        // Load team name if assigned
        if (userTeamId) {
          const team = await getTeam(userTeamId);
          setTeamName(team?.name || null);
        }
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, userTeamId]);

  const handleSave = async () => {
    if (!user?.email || !name.trim()) return;

    setSaving(true);
    try {
      const docRef = doc(db, "authorizedUsers", user.email);
      const finalRole = useCustomRole ? customRole.trim() : role;
      await updateDoc(docRef, {
        name: name.trim(),
        role: finalRole || null,
      });
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          My Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your display name and committee role
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </Label>
            <div className="flex items-center gap-2">
              <Input value={user?.email || ""} disabled className="bg-muted/50" />
              <Badge variant={accessLevel === "Admin" ? "default" : accessLevel === "Head's Access" ? "outline" : "secondary"} className="gap-1 shrink-0">
                {accessLevel === "Admin" ? (
                  <>
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </>
                ) : accessLevel === "Head's Access" ? (
                  <>
                    <UserCheck className="h-3 w-3" />
                    Head&apos;s Access
                  </>
                ) : (
                  <>
                    <Shield className="h-3 w-3" />
                    Member&apos;s Access
                  </>
                )}
              </Badge>
            </div>
            {teamName && (
              <p className="text-xs text-muted-foreground mt-1">
                Team: <span className="font-medium text-foreground">{teamName}</span>
              </p>
            )}
          </div>

          <Separator />

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="profile-name">Display Name *</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Committee Role</Label>
            {!useCustomRole ? (
              <div className="space-y-2">
                <Select value={role} onValueChange={(val) => val && setRole(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => { setUseCustomRole(true); setRole(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  My role isn&apos;t listed
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Enter your role"
                />
                <button
                  type="button"
                  onClick={() => { setUseCustomRole(false); setCustomRole(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Choose from list instead
                </button>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
