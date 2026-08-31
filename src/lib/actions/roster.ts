import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Team, Member, MemberFormData } from "@/types";

// ============================================================
// Teams
// ============================================================

export async function getTeams(): Promise<Team[]> {
  const q = query(collection(db, "teams"), orderBy("order", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Team[];
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const docRef = doc(db, "teams", teamId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Team;
}

// ============================================================
// Members
// ============================================================

export async function getTeamMembers(
  teamId: string,
  includeInactive = false
): Promise<Member[]> {
  const q = query(
    collection(db, "teams", teamId, "members"),
    orderBy("name", "asc")
  );
  const snapshot = await getDocs(q);
  const members = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Member[];

  if (includeInactive) return members;
  return members.filter((m) => m.active !== false);
}

export async function addMember(
  teamId: string,
  data: MemberFormData
): Promise<string> {
  const docRef = await addDoc(collection(db, "teams", teamId, "members"), {
    ...data,
    role: data.role || null,
    active: true,
  });
  return docRef.id;
}

export async function updateMember(
  teamId: string,
  memberId: string,
  data: Partial<MemberFormData>
): Promise<void> {
  const docRef = doc(db, "teams", teamId, "members", memberId);
  await updateDoc(docRef, {
    ...data,
    role: data.role || null,
  });
}

export async function toggleMemberActive(
  teamId: string,
  memberId: string,
  active: boolean
): Promise<void> {
  const docRef = doc(db, "teams", teamId, "members", memberId);
  await updateDoc(docRef, { active });
}

export async function deleteMember(
  teamId: string,
  memberId: string
): Promise<void> {
  const MAX_BATCH = 490;

  // Collect all refs to delete
  const refsToDelete: import("firebase/firestore").DocumentReference[] = [];

  // 1. Member document
  refsToDelete.push(doc(db, "teams", teamId, "members", memberId));

  // 2. All attendanceEntries for this member
  try {
    const entriesQ = query(
      collection(db, "attendanceEntries"),
      where("memberId", "==", memberId)
    );
    const entriesSnap = await getDocs(entriesQ);
    entriesSnap.docs.forEach((d) => refsToDelete.push(d.ref));
  } catch (err) {
    console.error("Error finding member entries to delete:", err);
  }

  // 3. All attendance summary records for this member
  try {
    const attendanceQ = query(
      collection(db, "attendance"),
      where("memberId", "==", memberId)
    );
    const attendanceSnap = await getDocs(attendanceQ);
    attendanceSnap.docs.forEach((d) => refsToDelete.push(d.ref));
  } catch (err) {
    console.error("Error finding member attendance records to delete:", err);
  }

  // Execute in chunked batches to respect Firestore's 500-op limit
  for (let i = 0; i < refsToDelete.length; i += MAX_BATCH) {
    const chunk = refsToDelete.slice(i, i + MAX_BATCH);
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}
