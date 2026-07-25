import { initializeApp, getApps, cert, getApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (privateKey) {
    // Remove surrounding quotes (some env providers add them)
    privateKey = privateKey.replace(/^["']|["']$/g, "");
    // Replace literal \n strings with actual newlines (from .env files)
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials missing. Please set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local"
    );
  }

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (error) {
    console.error("Firebase Admin Initialization Error:", error);
    throw error;
  }
}

// Lazy proxies so Firebase Admin is only initialized at runtime upon API request,
// preventing Next.js build-time initialization errors when env vars are empty.
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop: keyof Auth) {
    const authInstance = getAuth(getAdminApp());
    const value = authInstance[prop];
    return typeof value === "function" ? value.bind(authInstance) : value;
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_, prop: keyof Firestore) {
    const dbInstance = getFirestore(getAdminApp());
    const value = dbInstance[prop];
    return typeof value === "function" ? value.bind(dbInstance) : value;
  },
});

export default getAdminApp;
