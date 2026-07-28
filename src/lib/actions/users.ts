import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AuthorizedUser } from "@/types";

/**
 * Fetch all authorized users.
 * Requires the caller to be an authorized user (enforced by Firestore rules).
 */
export async function getAuthorizedUsers(): Promise<AuthorizedUser[]> {
  const snapshot = await getDocs(collection(db, "authorizedUsers"));
  const users = snapshot.docs.map((d) => ({
    email: d.id,
    ...d.data(),
    addedAt: d.data().addedAt?.toDate?.() ?? null,
  })) as AuthorizedUser[];

  // Sort by addedAt descending (newest first)
  users.sort((a, b) => {
    if (!a.addedAt && !b.addedAt) return 0;
    if (!a.addedAt) return 1;
    if (!b.addedAt) return -1;
    return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
  });

  return users;
}

/**
 * Add a new authorized user.
 * Requires the caller to be an admin (enforced by Firestore rules).
 */
export async function addAuthorizedUser(
  email: string,
  name: string,
  isAdmin: boolean
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  await setDoc(doc(db, "authorizedUsers", normalizedEmail), {
    name: name.trim(),
    isAdmin: isAdmin || false,
    addedAt: serverTimestamp(),
  });
}

/**
 * Update an authorized user's admin status or name.
 * Requires the caller to be an admin (enforced by Firestore rules).
 */
export async function updateAuthorizedUser(
  email: string,
  data: { name?: string; isAdmin?: boolean }
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.isAdmin !== undefined) updateData.isAdmin = data.isAdmin;

  await updateDoc(doc(db, "authorizedUsers", email), updateData);
}

/**
 * Remove an authorized user.
 * Requires the caller to be an admin (enforced by Firestore rules).
 */
export async function removeAuthorizedUser(email: string): Promise<void> {
  await deleteDoc(doc(db, "authorizedUsers", email));
}
