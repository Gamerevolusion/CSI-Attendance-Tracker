/**
 * Seed script: creates the 7 teams and an initial admin user in Firestore.
 *
 * Usage:
 *   npx tsx scripts/seed.ts <admin-email> [admin-name]
 *
 * Example:
 *   npx tsx scripts/seed.ts admin@gmail.com "Admin User"
 *
 * Requires .env.local to be present with FIREBASE_ADMIN_* variables.
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  console.error("❌ Missing Firebase Admin credentials in .env.local");
  console.error("   Required: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY");
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount as Parameters<typeof cert>[0]),
});

const db = getFirestore(app);

const TEAMS = [
  { name: "Core", order: 1, hasRoleField: false },
  { name: "PR and Documentation", order: 2, hasRoleField: true },
  { name: "Social Media", order: 3, hasRoleField: true },
  { name: "Design and Decor", order: 4, hasRoleField: true },
  { name: "Logistics", order: 5, hasRoleField: true },
  { name: "Technical", order: 6, hasRoleField: true },
  { name: "Event Management", order: 7, hasRoleField: true },
];

async function seed() {
  const adminEmail = process.argv[2];
  const adminName = process.argv[3] || "Admin";

  if (!adminEmail) {
    console.error("❌ Please provide an admin email as the first argument.");
    console.error("   Usage: npx tsx scripts/seed.ts <admin-email> [admin-name]");
    process.exit(1);
  }

  console.log("🌱 Seeding Firestore...\n");

  // 1. Seed teams
  console.log("📋 Creating teams...");
  const batch = db.batch();

  for (const team of TEAMS) {
    const ref = db.collection("teams").doc();
    batch.set(ref, team);
    console.log(`   ✓ ${team.name} (order: ${team.order})`);
  }

  await batch.commit();
  console.log("   ✅ All 7 teams created.\n");

  // 2. Create admin user
  console.log(`👤 Creating admin user: ${adminEmail}`);
  await db.collection("authorizedUsers").doc(adminEmail).set({
    name: adminName,
    isAdmin: true,
    addedAt: FieldValue.serverTimestamp(),
  });
  console.log(`   ✅ Admin user created: ${adminEmail}\n`);

  console.log("🎉 Seeding complete! You can now sign in with the admin account.");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
