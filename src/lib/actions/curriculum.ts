import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Curriculum, Subject } from "@/types";

// ============================================================
// Curriculum (Year + Department combinations)
// ============================================================

export async function getCurriculums(): Promise<Curriculum[]> {
  const snapshot = await getDocs(collection(db, "curriculum"));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Curriculum[];
}

export async function getCurriculum(yearDeptId: string): Promise<Curriculum | null> {
  const docRef = doc(db, "curriculum", yearDeptId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Curriculum;
}

export async function createCurriculum(
  year: string,
  department: string
): Promise<string> {
  const id = `${year}_${department}`;
  await setDoc(doc(db, "curriculum", id), {
    year,
    department,
  });
  return id;
}

export async function deleteCurriculum(yearDeptId: string): Promise<void> {
  // Delete all subjects first
  const subjects = await getSubjects(yearDeptId);
  for (const subject of subjects) {
    await deleteDoc(doc(db, "curriculum", yearDeptId, "subjects", subject.id));
  }
  await deleteDoc(doc(db, "curriculum", yearDeptId));
}

// ============================================================
// Subjects (within a curriculum)
// ============================================================

export async function getSubjects(yearDeptId: string): Promise<Subject[]> {
  const q = query(
    collection(db, "curriculum", yearDeptId, "subjects"),
    orderBy("order", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Subject[];
}

export async function addSubject(
  yearDeptId: string,
  data: Omit<Subject, "id">
): Promise<string> {
  const docRef = await addDoc(
    collection(db, "curriculum", yearDeptId, "subjects"),
    data
  );
  return docRef.id;
}

export async function updateSubject(
  yearDeptId: string,
  subjectId: string,
  data: Partial<Omit<Subject, "id">>
): Promise<void> {
  const docRef = doc(db, "curriculum", yearDeptId, "subjects", subjectId);
  await updateDoc(docRef, data);
}

export async function deleteSubject(
  yearDeptId: string,
  subjectId: string
): Promise<void> {
  await deleteDoc(doc(db, "curriculum", yearDeptId, "subjects", subjectId));
}

/**
 * Reorder subjects by writing new `order` values.
 */
export async function reorderSubjects(
  yearDeptId: string,
  orderedIds: string[]
): Promise<void> {
  const promises = orderedIds.map((id, index) =>
    updateDoc(doc(db, "curriculum", yearDeptId, "subjects", id), {
      order: index,
    })
  );
  await Promise.all(promises);
}
