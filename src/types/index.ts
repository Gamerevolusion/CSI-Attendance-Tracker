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
  active: boolean;
}

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

export interface AuthorizedUser {
  email: string; // document ID
  name: string;
  isAdmin: boolean;
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
}

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
}
