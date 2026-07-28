"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import type { AccessLevel } from "@/types";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  accessLevel: AccessLevel;
  teamId: string | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  accessLevel: "Member's Access",
  teamId: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("Member's Access");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if a user's email is in the authorizedUsers allowlist
  const checkAuthorization = useCallback(
    async (
      firebaseUser: User
    ): Promise<{
      authorized: boolean;
      admin: boolean;
      accessLevel: AccessLevel;
      teamId: string | null;
    }> => {
      if (!firebaseUser.email) {
        return { authorized: false, admin: false, accessLevel: "Member's Access", teamId: null };
      }

      try {
        const userDoc = await getDoc(
          doc(db, "authorizedUsers", firebaseUser.email)
        );

        if (!userDoc.exists()) {
          return { authorized: false, admin: false, accessLevel: "Member's Access", teamId: null };
        }

        const data = userDoc.data();
        const level: AccessLevel =
          data?.accessLevel === "Admin" ||
          data?.accessLevel === "Head's Access" ||
          data?.accessLevel === "Member's Access"
            ? data.accessLevel
            : data?.isAdmin === true
              ? "Admin"
              : "Member's Access";

        return {
          authorized: true,
          admin: level === "Admin" || data?.isAdmin === true,
          accessLevel: level,
          teamId: data?.teamId || null,
        };
      } catch {
        // If Firestore rules block the read, the user is not authorized
        return { authorized: false, admin: false, accessLevel: "Member's Access", teamId: null };
      }
    },
    []
  );

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const result = await checkAuthorization(firebaseUser);

        if (result.authorized) {
          setUser(firebaseUser);
          setIsAdmin(result.admin);
          setAccessLevel(result.accessLevel);
          setTeamId(result.teamId);
          setError(null);
        } else {
          // Unauthorized — sign out immediately
          await firebaseSignOut(auth);
          setUser(null);
          setIsAdmin(false);
          setAccessLevel("Member's Access");
          setTeamId(null);
          setError(
            "You're not authorized for this committee tracker. Contact your team lead to be added."
          );
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setAccessLevel("Member's Access");
        setTeamId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [checkAuthorization]);

  const signIn = async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);

      const authResult = await checkAuthorization(result.user);

      if (!authResult.authorized) {
        await firebaseSignOut(auth);
        setUser(null);
        setIsAdmin(false);
        setAccessLevel("Member's Access");
        setTeamId(null);
        setError(
          "You're not authorized for this committee tracker. Contact your team lead to be added."
        );
      } else {
        setUser(result.user);
        setIsAdmin(authResult.admin);
        setAccessLevel(authResult.accessLevel);
        setTeamId(authResult.teamId);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIsAdmin(false);
      setAccessLevel("Member's Access");
      setTeamId(null);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to sign out";
      setError(message);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, accessLevel, teamId, loading, error, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
