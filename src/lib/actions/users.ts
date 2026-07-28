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
import type { AuthorizedUser, AccessLevel } from "@/types";

/**
 * Helper to compute standardized AccessLevel from raw document data
 */
export function getAccessLevelFromData(data: { accessLevel?: string; isAdmin?: boolean }): AccessLevel {
  if (data.accessLevel === "Admin" || data.accessLevel === "Head's Access" || data.accessLevel === "Member's Access") {
    return data.accessLevel as AccessLevel;
  }
  return data.isAdmin ? "Admin" : "Member's Access";
}

/**
 * Fetch all authorized users.
 * Requires the caller to be an authorized user (enforced by Firestore rules).
 */
export async function getAuthorizedUsers(): Promise<AuthorizedUser[]> {
  const snapshot = await getDocs(collection(db, "authorizedUsers"));
  const users = snapshot.docs.map((d) => {
    const data = d.data();
    const accessLevel = getAccessLevelFromData(data);
    return {
      email: d.id,
      name: data.name,
      isAdmin: accessLevel === "Admin" || data.isAdmin === true,
      accessLevel,
      teamId: data.teamId || undefined,
      addedAt: data.addedAt?.toDate?.() ?? null,
    };
  }) as AuthorizedUser[];

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
  accessLevel: AccessLevel = "Member's Access",
  teamId?: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const docData: Record<string, unknown> = {
    name: name.trim(),
    accessLevel,
    isAdmin: accessLevel === "Admin",
    addedAt: serverTimestamp(),
  };

  // Only store teamId for Head / Member
  if (accessLevel !== "Admin" && teamId) {
    docData.teamId = teamId;
  }

  await setDoc(doc(db, "authorizedUsers", normalizedEmail), docData);
}

/**
 * Update an authorized user's access level, name, or team.
 * Requires the caller to be an admin (enforced by Firestore rules).
 */
export async function updateAuthorizedUser(
  email: string,
  data: { name?: string; isAdmin?: boolean; accessLevel?: AccessLevel; teamId?: string | null }
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.accessLevel !== undefined) {
    updateData.accessLevel = data.accessLevel;
    updateData.isAdmin = data.accessLevel === "Admin";
    // Clear teamId when promoting to Admin
    if (data.accessLevel === "Admin") {
      updateData.teamId = null;
    }
  } else if (data.isAdmin !== undefined) {
    updateData.isAdmin = data.isAdmin;
    updateData.accessLevel = data.isAdmin ? "Admin" : "Member's Access";
  }

  if (data.teamId !== undefined) {
    updateData.teamId = data.teamId;
  }

  await updateDoc(doc(db, "authorizedUsers", email), updateData);
}

/**
 * Remove an authorized user.
 * Requires the caller to be an admin (enforced by Firestore rules).
 */
export async function removeAuthorizedUser(email: string): Promise<void> {
  await deleteDoc(doc(db, "authorizedUsers", email));
}
