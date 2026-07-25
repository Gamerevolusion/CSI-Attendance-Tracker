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

const users = [
  { email: "jaydeepborgaonkar129@gmail.com", name: "Jaydeep Borgaonkar", isAdmin: false },
  { email: "csi.jaydeep@gmail.com", name: "Jaydeep Borgaonkar", isAdmin: false },
  { email: "angadcd1087@gmail.com", name: "Angad Dhabholkar", isAdmin: false },
  { email: "adhishree.csi.2025@gmail.com", name: "Adhishree Ambre", isAdmin: false },
  { email: "csi.shreyapandey@gmail.com", name: "Shreya Pandey", isAdmin: false },
  { email: "pandeyshreya885@gmail.com", name: "Shreya Pandey", isAdmin: false },
  { email: "csi.sohamsharma@gmail.com", name: "Soham Sharma", isAdmin: false },
  { email: "prasannapednekar24@gmail.com", name: "Prasanna Pednekar", isAdmin: false },
  { email: "sharmajikabeta.csi@gmail.com", name: "Prince Sharma", isAdmin: false },
];

async function main() {
  console.log("🌱 Adding authorized users...\n");

  for (const user of users) {
    await db.collection("authorizedUsers").doc(user.email).set({
      name: user.name,
      isAdmin: user.isAdmin,
      addedAt: FieldValue.serverTimestamp(),
    });
    console.log(`   ✓ ${user.name} (${user.email})`);
  }

  console.log(`\n✅ All ${users.length} users added.`);
  process.exit(0);
}

main().catch(console.error);
