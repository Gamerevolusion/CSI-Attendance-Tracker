import {
  doc,
  getDocs,
  deleteDoc,
  query,
  where,
  collection,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AttendanceRecord, AttendanceRow } from "@/types";

// ============================================================
// Save Attendance (batched upsert)
// ============================================================

/**
 * Save attendance for an entire team on a given date.
 * Uses deterministic doc IDs to upsert (overwrite if exists).
 */
export async function saveAttendance(
  teamId: string,
  date: string,
  lectureCount: number,
  rows: AttendanceRow[],
  markedByEmail: string
): Promise<void> {
  const batch = writeBatch(db);

  for (const row of rows) {
    const docId = `${teamId}_${row.memberId}_${date}`;
    const docRef = doc(db, "attendance", docId);

    batch.set(docRef, {
      teamId,
      memberId: row.memberId,
      memberName: row.memberName,
      date,
      lectureCount,
      lectures: row.lectures,
      totalMissed: row.lectures.filter(Boolean).length,
      markedBy: markedByEmail,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

// ============================================================
// Get Attendance
// ============================================================

/**
 * Get attendance records for a specific team on a specific date.
 */
export async function getAttendanceByTeamAndDate(
  teamId: string,
  date: string
): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, "attendance"),
    where("teamId", "==", teamId),
    where("date", "==", date)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as AttendanceRecord[];
}

/**
 * Get attendance records for a team within a date range.
 * Uses composite index on (teamId, date) for efficient querying.
 */
export async function getAttendanceByTeamAndDateRange(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, "attendance"),
    where("teamId", "==", teamId),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as AttendanceRecord[];
}
// ============================================================
// Delete Attendance (admin only)
// ============================================================

export async function deleteAttendanceRecord(
  attendanceId: string,
  teamId?: string,
  memberId?: string,
  date?: string
): Promise<void> {
  // 1. Delete from summary attendance collection
  try {
    await deleteDoc(doc(db, "attendance", attendanceId));
  } catch {
    // ignore
  }

  // 2. Query and delete all matching entries from attendanceEntries collection
  if (teamId && memberId && date) {
    const qEntries = query(
      collection(db, "attendanceEntries"),
      where("teamId", "==", teamId),
      where("memberId", "==", memberId),
      where("date", "==", date)
    );
    const snap = await getDocs(qEntries);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } else if (attendanceId) {
    try {
      await deleteDoc(doc(db, "attendanceEntries", attendanceId));
    } catch {
      // ignore
    }
  }
}
