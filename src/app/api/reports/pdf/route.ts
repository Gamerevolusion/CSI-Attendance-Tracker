import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import React from "react";

export const dynamic = "force-dynamic";

// Use dynamic import for @react-pdf/renderer to avoid SSR issues
async function generatePDF(data: {
  teams: { name: string; hasRoleField: boolean; rows: { name: string; role: string | null; year: string; department: string; totalMissed: number; sessionsRecorded: number }[] }[];
  startDate: string;
  endDate: string;
  generatedAt: string;
}) {
  const { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } = await import("@react-pdf/renderer");

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 10,
      fontFamily: "Helvetica",
    },
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontFamily: "Helvetica-Bold",
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 11,
      color: "#666666",
      marginBottom: 2,
    },
    meta: {
      fontSize: 8,
      color: "#999999",
      marginBottom: 16,
    },
    teamTitle: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      marginBottom: 10,
      marginTop: 4,
      color: "#333333",
    },
    table: {
      width: "100%",
    },
    tableHeader: {
      flexDirection: "row" as const,
      backgroundColor: "#f0f0f0",
      borderBottomWidth: 1,
      borderColor: "#cccccc",
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    tableRow: {
      flexDirection: "row" as const,
      borderBottomWidth: 0.5,
      borderColor: "#e0e0e0",
      paddingVertical: 5,
      paddingHorizontal: 4,
    },
    tableRowAlt: {
      flexDirection: "row" as const,
      borderBottomWidth: 0.5,
      borderColor: "#e0e0e0",
      paddingVertical: 5,
      paddingHorizontal: 4,
      backgroundColor: "#fafafa",
    },
    colName: { width: "25%", fontFamily: "Helvetica-Bold", fontSize: 9 },
    colRole: { width: "15%", fontSize: 9 },
    colYear: { width: "10%", fontSize: 9, textAlign: "center" as const },
    colDept: { width: "15%", fontSize: 9 },
    colMissed: { width: "18%", fontSize: 9, textAlign: "center" as const },
    colSessions: { width: "17%", fontSize: 9, textAlign: "center" as const },
    headerText: { fontFamily: "Helvetica-Bold", fontSize: 9 },
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
    noData: {
      textAlign: "center" as const,
      color: "#999999",
      paddingVertical: 20,
      fontSize: 11,
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
          React.createElement(
            Text,
            { style: styles.subtitle },
            `${data.startDate} to ${data.endDate}`
          ),
          React.createElement(
            Text,
            { style: styles.meta },
            `Generated: ${data.generatedAt}`
          )
        ),
        // Team title
        React.createElement(Text, { style: styles.teamTitle }, team.name),
        // Table
        team.rows.length === 0
          ? React.createElement(
              Text,
              { style: styles.noData },
              "No attendance data in this range"
            )
          : React.createElement(
              View,
              { style: styles.table },
              // Header row
              React.createElement(
                View,
                { style: styles.tableHeader },
                React.createElement(
                  Text,
                  { style: { ...styles.colName, ...styles.headerText } },
                  "Name"
                ),
                team.hasRoleField
                  ? React.createElement(
                      Text,
                      { style: { ...styles.colRole, ...styles.headerText } },
                      "Role"
                    )
                  : null,
                React.createElement(
                  Text,
                  { style: { ...styles.colYear, ...styles.headerText } },
                  "Year"
                ),
                React.createElement(
                  Text,
                  { style: { ...styles.colDept, ...styles.headerText } },
                  "Department"
                ),
                React.createElement(
                  Text,
                  { style: { ...styles.colMissed, ...styles.headerText } },
                  "Total Missed"
                ),
                React.createElement(
                  Text,
                  { style: { ...styles.colSessions, ...styles.headerText } },
                  "Sessions"
                )
              ),
              // Data rows
              ...team.rows.map((row, rowIndex) =>
                React.createElement(
                  View,
                  {
                    key: rowIndex,
                    style: rowIndex % 2 === 0 ? styles.tableRow : styles.tableRowAlt,
                  },
                  React.createElement(Text, { style: styles.colName }, row.name),
                  team.hasRoleField
                    ? React.createElement(
                        Text,
                        { style: styles.colRole },
                        row.role || "—"
                      )
                    : null,
                  React.createElement(
                    Text,
                    { style: styles.colYear },
                    row.year
                  ),
                  React.createElement(
                    Text,
                    { style: styles.colDept },
                    row.department
                  ),
                  React.createElement(
                    Text,
                    { style: styles.colMissed },
                    String(row.totalMissed)
                  ),
                  React.createElement(
                    Text,
                    { style: styles.colSessions },
                    String(row.sessionsRecorded)
                  )
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

    // Fetch data for all requested teams
    const teamsData = [];

    for (const teamId of teamIds) {
      const teamDoc = await getAdminDb().collection("teams").doc(teamId).get();
      if (!teamDoc.exists) continue;

      const team = teamDoc.data()!;

      // Get members
      const membersSnapshot = await getAdminDb()
        .collection("teams")
        .doc(teamId)
        .collection("members")
        .orderBy("name")
        .get();

      // Get attendance
      const attendanceSnapshot = await getAdminDb()
        .collection("attendance")
        .where("teamId", "==", teamId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
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
        });
      }

      for (const doc of attendanceSnapshot.docs) {
        const record = doc.data();
        const entry = memberMap.get(record.memberId);
        if (entry) {
          entry.totalMissed += record.totalMissed;
          entry.dates.add(record.date);
        }
      }

      const rows = Array.from(memberMap.values()).map(
        ({ dates, ...rest }) => ({
          ...rest,
          sessionsRecorded: dates.size,
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
