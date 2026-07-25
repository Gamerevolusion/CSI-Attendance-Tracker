import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

async function main() {
  await db.collection("authorizedUsers").doc("golenishant2001@gmail.com").set({
    name: "Nishant Gole",
    isAdmin: false,
    role: "Chairperson",
    addedAt: FieldValue.serverTimestamp(),
  });
  console.log("✅ Added Nishant Gole (golenishant2001@gmail.com) as Chairperson");
  process.exit(0);
}

main().catch(console.error);
