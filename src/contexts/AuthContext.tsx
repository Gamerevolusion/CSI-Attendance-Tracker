"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
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

// ============================================================
// Context 1: User Identity (rarely changes)
// ============================================================

interface AuthUserContextType {
  user: User | null;
  isAdmin: boolean;
}

const AuthUserContext = createContext<AuthUserContextType>({
  user: null,
  isAdmin: false,
});

export function useAuthUser() {
  const context = useContext(AuthUserContext);
  if (!context) {
    throw new Error("useAuthUser must be used within an AuthUserProvider");
  }
  return context;
}

// ============================================================
// Context 2: Permissions (changes on team/access level switch)
// ============================================================

interface AuthPermissionsContextType {
  accessLevel: AccessLevel;
  teamId: string | null;
}

const AuthPermissionsContext = createContext<AuthPermissionsContextType>({
  accessLevel: "Member's Access",
  teamId: null,
});

export function useAuthPermissions() {
  const context = useContext(AuthPermissionsContext);
  if (!context) {
    throw new Error("useAuthPermissions must be used within an AuthPermissionsProvider");
  }
  return context;
}

// ============================================================
// Context 3: Auth State & Actions (transient, loading/error)
// ============================================================

interface AuthStateContextType {
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthStateContext = createContext<AuthStateContextType>({
  loading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuthState() {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error("useAuthState must be used within an AuthStateProvider");
  }
  return context;
}

// ============================================================
// Combined hook for backward compatibility
// ============================================================

export interface AuthContextType {
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

// ============================================================
// Main Provider Component
// ============================================================

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
        const userDoc = await getDoc(doc(db, "authorizedUsers", firebaseUser.email));

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

  const signIn = useCallback(async () => {
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
      const message = err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [checkAuthorization]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIsAdmin(false);
      setAccessLevel("Member's Access");
      setTeamId(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign out";
      setError(message);
    }
  }, []);

  // Memoize context values to prevent unnecessary re-renders
  const authUserValue = useMemo(
    () => ({ user, isAdmin }),
    [user, isAdmin]
  );

  const authPermissionsValue = useMemo(
    () => ({ accessLevel, teamId }),
    [accessLevel, teamId]
  );

  const authStateValue = useMemo(
    () => ({ loading, error, signIn, signOut }),
    [loading, error, signIn, signOut]
  );

  const authCombinedValue = useMemo(
    () => ({
      user,
      isAdmin,
      accessLevel,
      teamId,
      loading,
      error,
      signIn,
      signOut,
    }),
    [user, isAdmin, accessLevel, teamId, loading, error, signIn, signOut]
  );

  return (
    <AuthUserContext.Provider value={authUserValue}>
      <AuthPermissionsContext.Provider value={authPermissionsValue}>
        <AuthStateContext.Provider value={authStateValue}>
          <AuthContext.Provider value={authCombinedValue}>
            {children}
          </AuthContext.Provider>
        </AuthStateContext.Provider>
      </AuthPermissionsContext.Provider>
    </AuthUserContext.Provider>
  );
}