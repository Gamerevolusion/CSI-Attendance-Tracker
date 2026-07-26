import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
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
