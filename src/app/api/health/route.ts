import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Completely isolated health check - no imports from our code
export async function GET() {
  const checks: Record<string, unknown> = {};

  try {
    // 1. Check env vars
    checks.projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "MISSING";
    checks.clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "MISSING";
    const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    checks.privateKeyPresent = !!rawKey;
    checks.privateKeyLength = rawKey?.length || 0;
    checks.privateKeyFirst30 = rawKey?.substring(0, 30) || "MISSING";
    checks.privateKeyLast20 = rawKey?.substring((rawKey?.length || 0) - 20) || "MISSING";

    // 2. Try dynamic import of firebase-admin
    try {
      const { initializeApp, getApps, cert, getApp } = await import("firebase-admin/app");
      checks.firebaseAdminImported = true;

      let app;
      const apps = getApps();
      if (apps.length > 0) {
        app = getApp();
        checks.appReused = true;
      } else {
        let privateKey = rawKey || "";
        privateKey = privateKey.replace(/^["']|["']$/g, "");
        privateKey = privateKey.replace(/\\n/g, "\n");
        
        checks.cleanedKeyFirst30 = privateKey.substring(0, 30);
        checks.cleanedKeyHasNewlines = privateKey.includes("\n");
        checks.cleanedKeyNewlineCount = (privateKey.match(/\n/g) || []).length;

        app = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
            privateKey,
          }),
        });
        checks.appCreated = true;
      }

      // 3. Try Firestore
      try {
        const { getFirestore } = await import("firebase-admin/firestore");
        const db = getFirestore(app);
        const snapshot = await db.collection("authorizedUsers").limit(1).get();
        checks.firestoreWorking = true;
        checks.firstDoc = snapshot.docs[0]?.id || "none";
      } catch (fsErr) {
        checks.firestoreError = fsErr instanceof Error ? fsErr.message : String(fsErr);
      }
    } catch (initErr) {
      checks.firebaseAdminImported = false;
      checks.initError = initErr instanceof Error ? initErr.message : String(initErr);
      checks.initErrorStack = initErr instanceof Error ? initErr.stack?.substring(0, 500) : undefined;
    }
  } catch (outerErr) {
    checks.outerError = outerErr instanceof Error ? outerErr.message : String(outerErr);
  }

  return NextResponse.json(checks, { status: 200 });
}
