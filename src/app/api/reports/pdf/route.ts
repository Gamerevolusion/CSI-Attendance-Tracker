import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import React from "react";

export const dynamic = "force-dynamic";

interface SubjectBreakdownRow {
  subjectName: string;
  facultyName: string;
  missed: number;
}

interface MemberRow {
  name: string;
  role: string | null;
  year: string;
  department: string;
  totalMissed: number;
  sessionsRecorded: number;
  subjectBreakdown: SubjectBreakdownRow[];
}

interface TeamData {
  name: string;
  hasRoleField: boolean;
  rows: MemberRow[];
}

async function generatePDF(data: {
  teams: TeamData[];
  startDate: string;
  endDate: string;
  generatedAt: string;
}) {
  const { Document, Page, Text, View, StyleSheet, renderToBuffer } = await import("@react-pdf/renderer");

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
    header: { marginBottom: 20 },
    title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    subtitle: { fontSize: 11, color: "#666666", marginBottom: 2 },
    meta: { fontSize: 8, color: "#999999", marginBottom: 16 },
    teamTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 10, marginTop: 4, color: "#333333" },
    memberHeader: { flexDirection: "row" as const, justifyContent: "space-between" as const, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderColor: "#e0e0e0" },
    memberName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
    memberMeta: { fontSize: 9, color: "#666666" },
    totalBadge: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#e53e3e" },
    totalBadgeGood: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#38a169" },
    subjectTable: { width: "100%", marginBottom: 12 },
    subjectHeader: { flexDirection: "row" as const, backgroundColor: "#f5f5f5", borderBottomWidth: 1, borderColor: "#cccccc", paddingVertical: 4, paddingHorizontal: 4 },
    subjectRow: { flexDirection: "row" as const, borderBottomWidth: 0.5, borderColor: "#e0e0e0", paddingVertical: 3, paddingHorizontal: 4 },
    subjectRowAlt: { flexDirection: "row" as const, borderBottomWidth: 0.5, borderColor: "#e0e0e0", paddingVertical: 3, paddingHorizontal: 4, backgroundColor: "#fafafa" },
    colSubject: { width: "35%", fontSize: 9 },
    colFaculty: { width: "40%", fontSize: 9, color: "#666666" },
    colMissed: { width: "25%", fontSize: 9, textAlign: "center" as const, fontFamily: "Helvetica-Bold" },
    headerText: { fontFamily: "Helvetica-Bold", fontSize: 9 },
    memberBlock: { marginBottom: 16 },
    noData: { textAlign: "center" as const, color: "#999999", paddingVertical: 20, fontSize: 11 },
    footer: {
      position: "absolute" as const,
      bottom: 20,
      left: 40,
      right: 40,
      fontSize: 8,
      color: "#999999",
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
    },
  });

  const doc = React.createElement(
    Document,
    null,
    data.teams.map((team, teamIndex) =>
      React.createElement(
        Page,
        { key: teamIndex, size: "A4", style: styles.page },
        // Header
        React.createElement(
          View,
          { style: styles.header },
          React.createElement(Text, { style: styles.title }, "CSI Attendance Report"),
          React.createElement(Text, { style: styles.subtitle }, `${data.startDate} to ${data.endDate}`),
          React.createElement(Text, { style: styles.meta }, `Generated: ${data.generatedAt}`)
        ),
        // Team title
        React.createElement(Text, { style: styles.teamTitle }, team.name),
        // Members
        team.rows.length === 0
          ? React.createElement(Text, { style: styles.noData }, "No attendance data in this range")
          : React.createElement(
              View,
              null,
              ...team.rows.map((row, rowIndex) =>
                React.createElement(
                  View,
                  { key: rowIndex, style: styles.memberBlock, wrap: false },
                  // Member header
                  React.createElement(
                    View,
                    { style: styles.memberHeader },
                    React.createElement(
                      View,
                      null,
                      React.createElement(Text, { style: styles.memberName }, row.name),
                      React.createElement(
                        Text,
                        { style: styles.memberMeta },
                        `${row.year} · ${row.department}${row.role ? ` · ${row.role}` : ""} · ${row.sessionsRecorded} day(s) recorded`
                      )
                    ),
                    React.createElement(
                      Text,
                      { style: row.totalMissed === 0 ? styles.totalBadgeGood : styles.totalBadge },
                      `${row.totalMissed} missed`
                    )
                  ),
                  // Subject breakdown table
                  row.subjectBreakdown.length > 0
                    ? React.createElement(
                        View,
                        { style: styles.subjectTable },
                        // Header
                        React.createElement(
                          View,
                          { style: styles.subjectHeader },
                          React.createElement(Text, { style: { ...styles.colSubject, ...styles.headerText } }, "Subject"),
                          React.createElement(Text, { style: { ...styles.colFaculty, ...styles.headerText } }, "Faculty"),
                          React.createElement(Text, { style: { ...styles.colMissed, ...styles.headerText } }, "Missed")
                        ),
                        // Rows
                        ...row.subjectBreakdown.map((sub, si) =>
                          React.createElement(
                            View,
                            { key: si, style: si % 2 === 0 ? styles.subjectRow : styles.subjectRowAlt },
                            React.createElement(Text, { style: styles.colSubject }, sub.subjectName),
                            React.createElement(Text, { style: styles.colFaculty }, sub.facultyName),
                            React.createElement(Text, { style: styles.colMissed }, String(sub.missed))
                          )
                        )
                      )
                    : null
                )
              )
            ),
        // Footer
        React.createElement(
          View,
          { style: styles.footer, fixed: true },
          React.createElement(Text, null, "CSI Committee Attendance Report"),
          React.createElement(
            Text,
            { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` }
          )
        )
      )
    )
  );

  const buffer = await renderToBuffer(doc);
  return buffer;
}

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const email = decodedToken.email;

    if (!email) {
      return NextResponse.json({ error: "No email in token" }, { status: 401 });
    }

    // Check if user is authorized
    const userDoc = await getAdminDb().collection("authorizedUsers").doc(email).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Parse request
    const body = await request.json();
    const { teamIds, startDate, endDate } = body as {
      teamIds: string[];
      startDate: string;
      endDate: string;
    };

    if (!teamIds?.length || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();

    // Build subject lookup from curriculum collection
    const subjectLookup = new Map<string, { subjectName: string; facultyName: string }>();
    const curriculumSnapshot = await adminDb.collection("curriculum").get();
    for (const currDoc of curriculumSnapshot.docs) {
      const subjectsSnapshot = await adminDb
        .collection("curriculum")
        .doc(currDoc.id)
        .collection("subjects")
        .get();
      for (const subDoc of subjectsSnapshot.docs) {
        const subData = subDoc.data();
        subjectLookup.set(subDoc.id, {
          subjectName: subData.subjectName || subDoc.id,
          facultyName: subData.facultyName || "—",
        });
      }
    }

    // Fetch data for all requested teams
    const teamsData: TeamData[] = [];

    for (const teamId of teamIds) {
      const teamDoc = await adminDb.collection("teams").doc(teamId).get();
      if (!teamDoc.exists) continue;

      const team = teamDoc.data()!;

      // Get members
      const membersSnapshot = await adminDb
        .collection("teams")
        .doc(teamId)
        .collection("members")
        .orderBy("name")
        .get();

      // Get attendance entries (new system) - single-field index query
      const entriesSnapshot = await adminDb
        .collection("attendanceEntries")
        .where("teamId", "==", teamId)
        .get();

      // Build summary
      const memberMap = new Map<
        string,
        {
          name: string;
          role: string | null;
          year: string;
          department: string;
          totalMissed: number;
          dates: Set<string>;
          subjectMissed: Record<string, number>;
        }
      >();

      for (const doc of membersSnapshot.docs) {
        const m = doc.data();
        memberMap.set(doc.id, {
          name: m.name,
          role: m.role || null,
          year: m.year,
          department: m.department,
          totalMissed: 0,
          dates: new Set(),
          subjectMissed: {},
        });
      }

      for (const doc of entriesSnapshot.docs) {
        const entry = doc.data();
        if (entry.date < startDate || entry.date > endDate) continue;
        const member = memberMap.get(entry.memberId);
        if (member) {
          member.totalMissed += entry.missed || 0;
          member.dates.add(entry.date);
          if (!member.subjectMissed[entry.subjectId]) {
            member.subjectMissed[entry.subjectId] = 0;
          }
          member.subjectMissed[entry.subjectId] += entry.missed || 0;
        }
      }

      const rows: MemberRow[] = Array.from(memberMap.values()).map(
        ({ dates, subjectMissed, ...rest }) => ({
          ...rest,
          sessionsRecorded: dates.size,
          subjectBreakdown: Object.entries(subjectMissed).map(
            ([subId, missed]) => ({
              subjectName: subjectLookup.get(subId)?.subjectName || subId,
              facultyName: subjectLookup.get(subId)?.facultyName || "—",
              missed,
            })
          ),
        })
      );

      teamsData.push({
        name: team.name as string,
        hasRoleField: team.hasRoleField as boolean,
        rows,
      });
    }

    // Generate PDF
    const now = new Date();
    const generatedAt = now.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const pdfBuffer = await generatePDF({
      teams: teamsData,
      startDate,
      endDate,
      generatedAt,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="attendance-report_${startDate}_${endDate}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
