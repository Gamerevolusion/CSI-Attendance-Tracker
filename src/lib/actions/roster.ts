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
  const batch = writeBatch(db);

  // 1. Delete member document
  const memberRef = doc(db, "teams", teamId, "members", memberId);
  batch.delete(memberRef);

  // 2. Delete all attendanceEntries for this member
  try {
    const entriesQ = query(
      collection(db, "attendanceEntries"),
      where("memberId", "==", memberId)
    );
    const entriesSnap = await getDocs(entriesQ);
    entriesSnap.docs.forEach((d) => batch.delete(d.ref));
  } catch (err) {
    console.error("Error finding member entries to delete:", err);
  }

  // 3. Delete all attendance summary records for this member
  try {
    const attendanceQ = query(
      collection(db, "attendance"),
      where("memberId", "==", memberId)
    );
    const attendanceSnap = await getDocs(attendanceQ);
    attendanceSnap.docs.forEach((d) => batch.delete(d.ref));
  } catch (err) {
    console.error("Error finding member attendance records to delete:", err);
  }

  await batch.commit();
}
