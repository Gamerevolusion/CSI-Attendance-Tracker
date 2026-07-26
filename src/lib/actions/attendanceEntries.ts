import {
  doc,
  getDocs,
  deleteDoc,
  query,
  where,
  collection,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AttendanceEntry } from "@/types";

// ============================================================
// Save / Update Attendance Entries (batch upsert)
// ============================================================

export interface EntryWrite {
  memberId: string;
  teamId: string;
  subjectId: string;
  date: string;
  missed: number;
  note: string | null;
}

/**
 * Batch-write attendance entries. Uses deterministic doc IDs.
 * Only writes entries that actually have data (state !== "no-class").
 * For "no-class" entries that previously existed, deletes the document.
 */
export async function saveAttendanceEntries(
  entries: EntryWrite[],
  deletions: string[], // doc IDs to remove (cell went back to "no-class")
  markedByEmail: string
): Promise<void> {
  const batch = writeBatch(db);

  for (const entry of entries) {
    const docId = `${entry.memberId}_${entry.subjectId}_${entry.date}`;
    const docRef = doc(db, "attendanceEntries", docId);
    batch.set(docRef, {
      memberId: entry.memberId,
      teamId: entry.teamId,
      subjectId: entry.subjectId,
      date: entry.date,
      missed: entry.missed,
      note: entry.note,
      markedBy: markedByEmail,
      updatedAt: serverTimestamp(),
    });
  }

  for (const docId of deletions) {
    batch.delete(doc(db, "attendanceEntries", docId));
  }

  await batch.commit();
}

// ============================================================
// Query Attendance Entries
// ============================================================

/**
 * Get all entries for a specific member within a date range.
 */
export async function getEntriesByMember(
  memberId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceEntry[]> {
  const q = query(
    collection(db, "attendanceEntries"),
    where("memberId", "==", memberId),
    where("date", ">=", startDate),
    where("date", "<=", endDate)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    updatedAt: d.data().updatedAt?.toDate() || new Date(),
  })) as AttendanceEntry[];
}

/**
 * Get all entries for a team within a date range.
 */
export async function getEntriesByTeam(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceEntry[]> {
  const q = query(
    collection(db, "attendanceEntries"),
    where("teamId", "==", teamId),
    where("date", ">=", startDate),
    where("date", "<=", endDate)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    updatedAt: d.data().updatedAt?.toDate() || new Date(),
  })) as AttendanceEntry[];
}

/**
 * Delete a single attendance entry (admin only).
 */
export async function deleteAttendanceEntry(entryId: string): Promise<void> {
  await deleteDoc(doc(db, "attendanceEntries", entryId));
}
