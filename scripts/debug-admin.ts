// Quick diagnostic script — tests Firebase Admin initialization directly
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

console.log("--- Environment Variables ---");
console.log("PROJECT_ID:", process.env.FIREBASE_ADMIN_PROJECT_ID);
console.log("CLIENT_EMAIL:", process.env.FIREBASE_ADMIN_CLIENT_EMAIL);

const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
console.log("PRIVATE_KEY present:", !!rawKey);
console.log("PRIVATE_KEY length:", rawKey?.length);
console.log("PRIVATE_KEY starts with quote:", rawKey?.startsWith('"'));
console.log("PRIVATE_KEY ends with quote:", rawKey?.endsWith('"'));
console.log("PRIVATE_KEY first 40 chars:", rawKey?.substring(0, 40));

// Clean the key the same way firebase-admin.ts does
let privateKey = rawKey;
if (privateKey) {
  privateKey = privateKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

console.log("\n--- After cleaning ---");
console.log("Cleaned key starts with '-----BEGIN':", privateKey?.startsWith("-----BEGIN"));
console.log("Cleaned key contains actual newlines:", privateKey?.includes("\n"));

try {
  console.log("\n--- Initializing Firebase Admin ---");
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: privateKey!,
    }),
  });
  console.log("✅ Firebase Admin initialized successfully");

  const db = getFirestore(app);
  console.log("\n--- Querying authorizedUsers ---");
  db.collection("authorizedUsers").get().then((snapshot) => {
    console.log(`✅ Found ${snapshot.size} authorized users:`);
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`   ${doc.id} → name: ${data.name}, isAdmin: ${data.isAdmin}`);
    });

    console.log("\n--- Testing verifyIdToken (will fail without a real token, expected) ---");
    getAuth(app).verifyIdToken("fake-token").catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("Expected auth error:", msg.substring(0, 100));
      process.exit(0);
    });
  }).catch((err) => {
    console.error("❌ Firestore query failed:", err);
    process.exit(1);
  });
} catch (error) {
  console.error("\n❌ Firebase Admin initialization FAILED:", error);
  process.exit(1);
}
