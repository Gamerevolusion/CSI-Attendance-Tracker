// ============================================================
// Firestore Data Model Types
// ============================================================

export interface Team {
  id: string;
  name: string;
  order: number;
  hasRoleField: boolean;
}

export interface Member {
  id: string;
  name: string;
  role: string | null;
  year: string;
  department: string;
  rollNo?: string;
  active: boolean;
}

// --- Old L1–L6 model (read-only, historical) ---

export interface AttendanceRecord {
  id: string; // deterministic: `${teamId}_${memberId}_${date}`
  teamId: string;
  memberId: string;
  memberName: string; // denormalized for history reads
  date: string; // ISO "YYYY-MM-DD"
  lectureCount: number; // total lectures that day, default 6
  lectures: boolean[]; // length === lectureCount, true = missed
  totalMissed: number; // count of true values, computed on write
  markedBy: string; // email of who recorded it
  updatedAt: Date;
}

// --- New per-subject model ---

export interface Curriculum {
  id: string; // e.g. "SY_CS"
  year: string;
  department: string;
}

export interface Subject {
  id: string;
  subjectName: string;
  facultyName: string;
  type: "Lecture" | "Practical";
  order: number;
}

export interface AttendanceEntry {
  id: string; // `${memberId}_${subjectId}_${date}`
  memberId: string;
  teamId: string;
  subjectId: string;
  date: string; // ISO "YYYY-MM-DD"
  missed: number; // periods missed, 0 = attended
  note: string | null;
  markedBy: string;
  updatedAt: Date;
}

// ============================================================
// Auth
// ============================================================

export type AccessLevel = "Admin" | "Head's Access" | "Member's Access";

export interface AuthorizedUser {
  email: string; // document ID
  name: string;
  isAdmin: boolean;
  accessLevel?: AccessLevel;
  teamId?: string; // assigned team (for Head / Member)
  addedAt: Date;
}

// ============================================================
// UI / Form Types
// ============================================================

export interface MemberFormData {
  name: string;
  role: string;
  year: string;
  department: string;
  rollNo?: string;
}

// Old grid types (kept for history page)
export interface AttendanceRow {
  memberId: string;
  memberName: string;
  lectures: boolean[]; // true = missed
  totalMissed: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ReportSummaryRow {
  memberId: string;
  memberName: string;
  role: string | null;
  year: string;
  department: string;
  totalMissed: number;
  sessionsRecorded: number;
  subjectBreakdown?: { subjectName: string; facultyName: string; missed: number }[];
}

// --- Attendance card UI types ---

/** One cell in the subject × date grid inside a member card */
export type CellState = "no-class" | "present" | "missed";

export interface CellData {
  state: CellState;
  missed: number; // only relevant when state === "missed"
  note: string | null;
  dirty: boolean; // changed since loaded
}

export interface MemberCardData {
  member: Member;
  subjects: Subject[];
  /** cells[subjectId][dateStr] */
  cells: Record<string, Record<string, CellData>>;
}
