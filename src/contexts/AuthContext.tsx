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

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if a user's email is in the authorizedUsers allowlist
  const checkAuthorization = useCallback(
    async (firebaseUser: User): Promise<{ authorized: boolean; admin: boolean }> => {
      if (!firebaseUser.email) {
        return { authorized: false, admin: false };
      }

      try {
        const userDoc = await getDoc(
          doc(db, "authorizedUsers", firebaseUser.email)
        );

        if (!userDoc.exists()) {
          return { authorized: false, admin: false };
        }

        const data = userDoc.data();
        return { authorized: true, admin: data?.isAdmin === true };
      } catch {
        // If Firestore rules block the read, the user is not authorized
        return { authorized: false, admin: false };
      }
    },
    []
  );

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const { authorized, admin } = await checkAuthorization(firebaseUser);

        if (authorized) {
          setUser(firebaseUser);
          setIsAdmin(admin);
          setError(null);
        } else {
          // Unauthorized — sign out immediately
          await firebaseSignOut(auth);
          setUser(null);
          setIsAdmin(false);
          setError(
            "You're not authorized for this committee tracker. Contact your team lead to be added."
          );
        }
      } else {
        setUser(null);
        setIsAdmin(false);
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

      const { authorized, admin } = await checkAuthorization(result.user);

      if (!authorized) {
        await firebaseSignOut(auth);
        setUser(null);
        setIsAdmin(false);
        setError(
          "You're not authorized for this committee tracker. Contact your team lead to be added."
        );
      } else {
        setUser(result.user);
        setIsAdmin(admin);
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
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to sign out";
      setError(message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
