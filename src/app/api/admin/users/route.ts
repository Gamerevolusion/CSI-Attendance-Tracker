import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email;

    if (!email) return null;

    const userDoc = await adminDb.collection("authorizedUsers").doc(email).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) return null;

    return email;
  } catch {
    return null;
  }
}

// GET: list all authorized users
export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdmin(request);
  if (!adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const snapshot = await adminDb
    .collection("authorizedUsers")
    .orderBy("addedAt", "desc")
    .get();

  const users = snapshot.docs.map((doc) => ({
    email: doc.id,
    ...doc.data(),
    addedAt: doc.data().addedAt?.toDate?.()?.toISOString() || null,
  }));

  return NextResponse.json(users);
}

// POST: add a new authorized user
export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdmin(request);
  if (!adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { email, name, isAdmin } = body as {
    email: string;
    name: string;
    isAdmin: boolean;
  };

  if (!email || !name) {
    return NextResponse.json(
      { error: "Email and name are required" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  await adminDb.collection("authorizedUsers").doc(normalizedEmail).set({
    name: name.trim(),
    isAdmin: isAdmin || false,
    addedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}

// PUT: update an authorized user
export async function PUT(request: NextRequest) {
  const adminEmail = await verifyAdmin(request);
  if (!adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { email, name, isAdmin } = body as {
    email: string;
    name?: string;
    isAdmin?: boolean;
  };

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

  await adminDb.collection("authorizedUsers").doc(email).update(updateData);

  return NextResponse.json({ success: true });
}

// DELETE: remove an authorized user
export async function DELETE(request: NextRequest) {
  const adminEmail = await verifyAdmin(request);
  if (!adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Prevent self-removal
  if (email === adminEmail) {
    return NextResponse.json(
      { error: "Cannot remove your own account" },
      { status: 400 }
    );
  }

  await adminDb.collection("authorizedUsers").doc(email).delete();

  return NextResponse.json({ success: true });
}
