import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/^"|"$/g, "").replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

const emails = [
  "jaydeepborgaonkar129@gmail.com",
  "csi.jaydeep@gmail.com",
  "angadcd1087@gmail.com",
  "adhishree.csi.2025@gmail.com",
  "csi.shreyapandey@gmail.com",
  "pandeyshreya885@gmail.com",
  "csi.sohamsharma@gmail.com",
  "prasannapednekar24@gmail.com",
  "sharmajikabeta.csi@gmail.com",
  "golenishant2001@gmail.com",
  "hardik102006@gmail.com",
];

async function main() {
  console.log("🔧 Promoting all users to admin...\n");

  for (const email of emails) {
    await db.collection("authorizedUsers").doc(email).update({ isAdmin: true });
    console.log(`   ✓ ${email} → admin`);
  }

  console.log(`\n✅ All ${emails.length} users are now admins.`);
  process.exit(0);
}

main().catch(console.error);
