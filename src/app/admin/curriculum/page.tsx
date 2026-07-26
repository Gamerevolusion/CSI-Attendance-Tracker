"use client";

import { useState, useEffect } from "react";
import { AdminRoute } from "@/components/AdminRoute";
import {
  getCurriculums,
  createCurriculum,
  deleteCurriculum,
  getSubjects,
  addSubject,
  updateSubject,
  deleteSubject,
  reorderSubjects,
} from "@/lib/actions/curriculum";
import type { Curriculum, Subject } from "@/types";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  GripVertical,
  Pencil,
  BookOpen,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const YEARS = ["FY", "SY", "TY", "BE"];
const DEPARTMENTS = ["CS", "IT", "DS", "AIML", "AIDS", "EXTC", "MECH", "CIVIL", "ELEX"];

function CurriculumContent() {
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Create curriculum dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [newDept, setNewDept] = useState("");
  const [creating, setCreating] = useState(false);

  // Add/edit subject dialog
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subName, setSubName] = useState("");
  const [subFaculty, setSubFaculty] = useState("");
  const [subType, setSubType] = useState<"Lecture" | "Practical">("Lecture");
  const [savingSubject, setSavingSubject] = useState(false);

  // Load curriculums
  useEffect(() => {
    async function load() {
      try {
        const c = await getCurriculums();
        setCurriculums(c);
      } catch {
        toast.error("Failed to load curriculums");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load subjects when selection changes
  useEffect(() => {
    if (!selected) {
      setSubjects([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setSubjectsLoading(true);
      try {
        const s = await getSubjects(selected);
        if (!cancelled) setSubjects(s);
      } catch {
        if (!cancelled) toast.error("Failed to load subjects");
      } finally {
        if (!cancelled) setSubjectsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selected]);

  const handleCreateCurriculum = async () => {
    if (!newYear || !newDept) return;
    const id = `${newYear}_${newDept}`;
    if (curriculums.some((c) => c.id === id)) {
      toast.error(`${newYear} ${newDept} already exists`);
      return;
    }
    setCreating(true);
    try {
      await createCurriculum(newYear, newDept);
      const newCurr: Curriculum = { id, year: newYear, department: newDept };
      setCurriculums((prev) => [...prev, newCurr]);
      setSelected(id);
      setCreateOpen(false);
      setNewYear("");
      setNewDept("");
      toast.success(`Created ${newYear} ${newDept}`);
    } catch {
      toast.error("Failed to create curriculum");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCurriculum = async () => {
    if (!selected) return;
    const curr = curriculums.find((c) => c.id === selected);
    if (!confirm(`Delete ${curr?.year} ${curr?.department} and all its subjects?`)) return;
    try {
      await deleteCurriculum(selected);
      setCurriculums((prev) => prev.filter((c) => c.id !== selected));
      setSelected("");
      setSubjects([]);
      toast.success("Curriculum deleted");
    } catch {
      toast.error("Failed to delete curriculum");
    }
  };

  const openAddSubject = () => {
    setEditingSubject(null);
    setSubName("");
    setSubFaculty("");
    setSubType("Lecture");
    setSubjectOpen(true);
  };

  const openEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setSubName(subject.subjectName);
    setSubFaculty(subject.facultyName);
    setSubType(subject.type);
    setSubjectOpen(true);
  };

  const handleSaveSubject = async () => {
    if (!subName.trim() || !subFaculty.trim() || !selected) return;
    setSavingSubject(true);
    try {
      if (editingSubject) {
        await updateSubject(selected, editingSubject.id, {
          subjectName: subName.trim(),
          facultyName: subFaculty.trim(),
          type: subType,
        });
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === editingSubject.id
              ? { ...s, subjectName: subName.trim(), facultyName: subFaculty.trim(), type: subType }
              : s
          )
        );
        toast.success("Subject updated");
      } else {
        const id = await addSubject(selected, {
          subjectName: subName.trim(),
          facultyName: subFaculty.trim(),
          type: subType,
          order: subjects.length,
        });
        setSubjects((prev) => [
          ...prev,
          {
            id,
            subjectName: subName.trim(),
            facultyName: subFaculty.trim(),
            type: subType,
            order: subjects.length,
          },
        ]);
        toast.success("Subject added");
      }
      setSubjectOpen(false);
    } catch {
      toast.error("Failed to save subject");
    } finally {
      setSavingSubject(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!selected) return;
    try {
      await deleteSubject(selected, subjectId);
      setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
      toast.success("Subject removed");
    } catch {
      toast.error("Failed to delete subject");
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newSubjects = [...subjects];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSubjects.length) return;
    [newSubjects[index], newSubjects[targetIndex]] = [newSubjects[targetIndex], newSubjects[index]];
    setSubjects(newSubjects);
    try {
      await reorderSubjects(selected, newSubjects.map((s) => s.id));
    } catch {
      toast.error("Failed to reorder");
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
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          Curriculum Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define subjects per Year + Department. These apply across all teams.
        </p>
      </div>

      {/* Curriculum Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Year + Department
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <Select value={selected} onValueChange={(v) => v && setSelected(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a curriculum" />
                </SelectTrigger>
                <SelectContent>
                  {curriculums.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.year} — {c.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Curriculum
            </Button>
            {selected && (
              <Button variant="destructive" size="icon" onClick={handleDeleteCurriculum}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subjects */}
      {selected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Subjects — {curriculums.find((c) => c.id === selected)?.year}{" "}
                {curriculums.find((c) => c.id === selected)?.department}
              </CardTitle>
              <Button size="sm" onClick={openAddSubject}>
                <Plus className="mr-2 h-4 w-4" />
                Add Subject
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {subjectsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : subjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No subjects yet</p>
                <p className="text-xs mt-1">Add subjects for this Year + Department</p>
              </div>
            ) : (
              <div className="space-y-2">
                {subjects.map((subject, index) => (
                  <div
                    key={subject.id}
                    className="flex items-center gap-3 rounded-lg border p-3 bg-card"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{subject.subjectName}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {subject.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {subject.facultyName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleMove(index, "down")}
                        disabled={index === subjects.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Separator orientation="vertical" className="h-5" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditSubject(subject)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSubject(subject.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Curriculum Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Curriculum</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={newYear} onValueChange={(v) => v && setNewYear(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={newDept} onValueChange={(v) => v && setNewDept(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCurriculum} disabled={creating || !newYear || !newDept}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Subject Dialog */}
      <Dialog open={subjectOpen} onOpenChange={setSubjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubject ? "Edit Subject" : "Add Subject"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sub-name">Subject Name</Label>
              <Input
                id="sub-name"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="e.g. CN, DBMS, OS"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-faculty">Faculty Name</Label>
              <Input
                id="sub-faculty"
                value={subFaculty}
                onChange={(e) => setSubFaculty(e.target.value)}
                placeholder="e.g. Mr. Nishant Gole"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={subType} onValueChange={(v) => setSubType(v as "Lecture" | "Practical")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lecture">Lecture</SelectItem>
                  <SelectItem value="Practical">Practical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSubject} disabled={savingSubject || !subName.trim() || !subFaculty.trim()}>
              {savingSubject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSubject ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CurriculumPage() {
  return (
    <AdminRoute>
      <CurriculumContent />
    </AdminRoute>
  );
}
