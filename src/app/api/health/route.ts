import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Temporary health check — remove after debugging
export async function GET() {
  const checks: Record<string, unknown> = {};

  // 1. Check env vars exist
  checks.projectId = !!process.env.FIREBASE_ADMIN_PROJECT_ID;
  checks.clientEmail = !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  checks.privateKeyPresent = !!rawKey;
  checks.privateKeyLength = rawKey?.length || 0;
  checks.privateKeyStartsWithQuote = rawKey?.startsWith('"') || false;
  checks.privateKeyStartsWithBegin = rawKey?.startsWith("-----BEGIN") || false;
  checks.privateKeyContainsLiteralBackslashN = rawKey?.includes("\\n") || false;
  checks.privateKeyContainsRealNewline = rawKey?.includes("\n") || false;

  // 2. Try Firebase Admin init + Firestore read
  try {
    const snapshot = await adminDb.collection("authorizedUsers").limit(1).get();
    checks.firestoreWorking = true;
    checks.firestoreDocCount = snapshot.size;
  } catch (error) {
    checks.firestoreWorking = false;
    checks.firestoreError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(checks);
}
