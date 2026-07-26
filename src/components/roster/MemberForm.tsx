"use client";

import { useState } from "react";
import type { MemberFormData } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MemberFormProps {
  hasRoleField: boolean;
  initialData?: MemberFormData;
  onSubmit: (data: MemberFormData) => Promise<void>;
  onCancel: () => void;
}

const YEAR_OPTIONS = ["FY", "SY", "TY"];
const DEPT_OPTIONS = ["CS", "IT", "DS", "BCA"];

export function MemberForm({
  hasRoleField,
  initialData,
  onSubmit,
  onCancel,
}: MemberFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [role, setRole] = useState(initialData?.role || "");
  const [year, setYear] = useState(initialData?.year || "");
  const [department, setDepartment] = useState(initialData?.department || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !year || !department.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        role: hasRoleField ? role.trim() : "",
        year,
        department: department.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="member-name">Name *</Label>
        <Input
          id="member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          required
        />
      </div>

      {hasRoleField && (
        <div className="space-y-2">
          <Label htmlFor="member-role">Role</Label>
          <Input
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Team Lead, Co-Head"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="member-year">Year *</Label>
          <Select value={year} onValueChange={(val) => val && setYear(val)} required>
            <SelectTrigger id="member-year">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="member-department">Department *</Label>
          <Select value={department} onValueChange={(val) => val && setDepartment(val)} required>
            <SelectTrigger id="member-department">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {DEPT_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !name.trim() || !year || !department.trim()}>
          {submitting ? "Saving..." : initialData ? "Update" : "Add Member"}
        </Button>
      </div>
    </form>
  );
}
