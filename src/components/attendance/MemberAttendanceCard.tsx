"use client";

import { useState, useReducer, useMemo, useCallback, useEffect, useRef } from "react";
import { produce } from "immer";
import type { Member, Subject, CellData, CellState, AttendanceEntry } from "@/types";
import type { EntryWrite } from "@/lib/actions/attendanceEntries";
import { saveAttendanceEntries } from "@/lib/actions/attendanceEntries";
import { saveAttendance } from "@/lib/actions/attendance";
import { ChevronDown, ChevronRight, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Firestore batch limit — keep under 500 to be safe */
const MAX_BATCH_SIZE = 490;

interface MemberAttendanceCardProps {
  member: Member;
  teamId: string;
  subjects: Subject[];
  dates: string[]; // ISO date strings in order
  existingEntries: AttendanceEntry[]; // entries for THIS member
  markedByEmail: string;
}

// Action types for the reducer
type CellAction =
  | { type: "CYCLE_CELL"; subjectId: string; date: string }
  | { type: "SET_MISSED_COUNT"; subjectId: string; date: string; count: number }
  | { type: "SET_NOTE"; subjectId: string; date: string; note: string }
  | { type: "MARK_CLEAN"; subjectId: string; date: string }
  | { type: "MARK_ALL_CLEAN" }
  | { type: "RESET"; cells: Record<string, Record<string, CellData>> };

function buildCells(
  subjects: Subject[],
  dates: string[],
  existingEntries: AttendanceEntry[]
): Record<string, Record<string, CellData>> {
  const entryMap = new Map<string, AttendanceEntry>();
  for (const e of existingEntries) {
    entryMap.set(`${e.subjectId}_${e.date}`, e);
  }

  const cells: Record<string, Record<string, CellData>> = {};
  for (const subject of subjects) {
    cells[subject.id] = {};
    for (const date of dates) {
      const entry = entryMap.get(`${subject.id}_${date}`);
      if (entry) {
        cells[subject.id][date] = {
          state: entry.missed === 0 ? "present" : "missed",
          missed: entry.missed,
          note: entry.note,
          dirty: false,
        };
      } else {
        cells[subject.id][date] = {
          state: "no-class",
          missed: 0,
          note: null,
          dirty: false,
        };
      }
    }
  }
  return cells;
}

function cellsReducer(
  state: Record<string, Record<string, CellData>>,
  action: CellAction
): Record<string, Record<string, CellData>> {
  return produce(state, (draft) => {
    switch (action.type) {
      case "CYCLE_CELL": {
        const cell = draft[action.subjectId]?.[action.date];
        if (!cell) return;

        const nextState: Record<CellState, CellState> = {
          "no-class": "present",
          present: "missed",
          missed: "no-class",
        };

        cell.state = nextState[cell.state];
        if (cell.state === "missed") {
          cell.missed = cell.missed || 1;
        } else if (cell.state === "present") {
          cell.missed = 0;
        } else {
          cell.missed = 0;
          cell.note = null;
        }
        cell.dirty = true;
        break;
      }

      case "SET_MISSED_COUNT": {
        const cell = draft[action.subjectId]?.[action.date];
        if (!cell || cell.state !== "missed") return;
        cell.missed = Math.max(1, action.count);
        cell.dirty = true;
        break;
      }

      case "SET_NOTE": {
        const cell = draft[action.subjectId]?.[action.date];
        if (!cell || cell.state !== "missed") return;
        cell.note = action.note || null;
        cell.dirty = true;
        break;
      }

      case "MARK_CLEAN": {
        const cell = draft[action.subjectId]?.[action.date];
        if (cell) {
          cell.dirty = false;
        }
        break;
      }

      case "MARK_ALL_CLEAN": {
        for (const subId of Object.keys(draft)) {
          for (const date of Object.keys(draft[subId])) {
            if (draft[subId][date].dirty) {
              draft[subId][date].dirty = false;
            }
          }
        }
        break;
      }

      case "RESET":
        return action.cells;
    }
  });
}

export function MemberAttendanceCard({
  member,
  teamId,
  subjects,
  dates,
  existingEntries,
  markedByEmail,
}: MemberAttendanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keep a ref to existingEntries so handleSave always sees the latest
  const existingEntriesRef = useRef(existingEntries);
  useEffect(() => {
    existingEntriesRef.current = existingEntries;
  }, [existingEntries]);

  // Use reducer with Immer for granular state updates
  const [cells, dispatch] = useReducer(cellsReducer, null, () =>
    buildCells(subjects, dates, existingEntries)
  );

  // Reset cells when subjects, dates, or existingEntries change (e.g. team/date switch)
  useEffect(() => {
    dispatch({ type: "RESET", cells: buildCells(subjects, dates, existingEntries) });
  }, [subjects, dates, existingEntries]);

  // Compute total missed per date for the collapsed summary
  const totalMissedPerDate = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const date of dates) {
      let total = 0;
      for (const subject of subjects) {
        const cell = cells[subject.id]?.[date];
        if (cell && cell.state === "missed") {
          total += cell.missed;
        }
      }
      totals[date] = total;
    }
    return totals;
  }, [cells, dates, subjects]);

  const totalMissedOverall = useMemo(
    () => Object.values(totalMissedPerDate).reduce((a, b) => a + b, 0),
    [totalMissedPerDate]
  );

  const hasDirty = useMemo(() => {
    for (const subId of Object.keys(cells)) {
      for (const date of Object.keys(cells[subId])) {
        if (cells[subId][date].dirty) return true;
      }
    }
    return false;
  }, [cells]);

  // Memoized action dispatchers
  const cycleCell = useCallback(
    (subjectId: string, date: string) => {
      dispatch({ type: "CYCLE_CELL", subjectId, date });
    },
    []
  );

  const updateMissedCount = useCallback(
    (subjectId: string, date: string, count: number) => {
      dispatch({ type: "SET_MISSED_COUNT", subjectId, date, count });
    },
    []
  );

  const updateNote = useCallback(
    (subjectId: string, date: string, note: string) => {
      dispatch({ type: "SET_NOTE", subjectId, date, note });
    },
    []
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries: EntryWrite[] = [];
      const deletions: string[] = [];
      const currentExisting = existingEntriesRef.current;

      for (const subject of subjects) {
        for (const date of dates) {
          const cell = cells[subject.id]?.[date];
          if (!cell?.dirty) continue;

          const docId = `${member.id}_${subject.id}_${date}`;

          if (cell.state === "no-class") {
            // Use ref to avoid stale closure — checks whether an entry existed at load time
            const hadEntry = currentExisting.some(
              (e) => e.subjectId === subject.id && e.date === date
            );
            if (hadEntry) {
              deletions.push(docId);
            }
          } else {
            entries.push({
              memberId: member.id,
              teamId,
              subjectId: subject.id,
              date,
              missed: cell.missed,
              note: cell.note,
            });
          }
        }
      }

      if (entries.length > 0 || deletions.length > 0) {
        // Split into batches if we exceed Firestore's 500-operation limit
        const totalOps = entries.length + deletions.length;
        if (totalOps <= MAX_BATCH_SIZE) {
          await saveAttendanceEntries(entries, deletions, markedByEmail);
        } else {
          // Chunk into safe-sized batches
          let entryIdx = 0;
          let deleteIdx = 0;
          while (entryIdx < entries.length || deleteIdx < deletions.length) {
            const batchEntries: EntryWrite[] = [];
            const batchDeletions: string[] = [];
            let opsInBatch = 0;

            while (entryIdx < entries.length && opsInBatch < MAX_BATCH_SIZE) {
              batchEntries.push(entries[entryIdx++]);
              opsInBatch++;
            }
            while (deleteIdx < deletions.length && opsInBatch < MAX_BATCH_SIZE) {
              batchDeletions.push(deletions[deleteIdx++]);
              opsInBatch++;
            }

            await saveAttendanceEntries(batchEntries, batchDeletions, markedByEmail);
          }
        }

        // Sync summary records to attendance collection ONLY for dates with dirty cells
        const dirtyDates = new Set<string>();
        for (const subject of subjects) {
          for (const date of dates) {
            if (cells[subject.id]?.[date]?.dirty) dirtyDates.add(date);
          }
        }

        // Build all summary writes and execute in parallel
        const summaryPromises: Promise<void>[] = [];
        for (const date of dirtyDates) {
          let dateMissed = 0;
          let hasEntriesForDate = false;
          for (const subject of subjects) {
            const cell = cells[subject.id]?.[date];
            if (cell && cell.state !== "no-class") {
              hasEntriesForDate = true;
              if (cell.state === "missed") {
                dateMissed += cell.missed;
              }
            }
          }
          if (hasEntriesForDate) {
            // Build a proper lectures array matching actual subject count
            const lecturesArr = subjects.map((s) => {
              const c = cells[s.id]?.[date];
              return c?.state === "missed" && c.missed > 0;
            });
            summaryPromises.push(
              saveAttendance(
                teamId,
                date,
                subjects.length,
                [
                  {
                    memberId: member.id,
                    memberName: member.name,
                    lectures: lecturesArr,
                    totalMissed: dateMissed,
                  },
                ],
                markedByEmail
              )
            );
          }
        }
        if (summaryPromises.length > 0) {
          await Promise.all(summaryPromises);
        }
      }

      // Mark all cells as not dirty using reducer
      dispatch({ type: "MARK_ALL_CLEAN" });

      toast.success(`Saved attendance for ${member.name}`);
    } catch {
      toast.error(`Failed to save attendance for ${member.name}`);
    } finally {
      setSaving(false);
    }
  };

  // Format date for column header: "DD"
  const formatDateCol = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.getDate().toString();
  };

  return (
    <div className="neo-card">
      {/* Header — always visible */}
      <div
        className="neo-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm opacity-60">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{member.name}</span>
            <span className="text-xs opacity-60">
              {member.year} · {member.department}
            </span>
            {member.rollNo && (
              <span className="text-xs opacity-50">#{member.rollNo}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`neo-badge ${
              totalMissedOverall === 0 ? "neo-badge-good" : "neo-badge-warn"
            }`}
          >
            {totalMissedOverall}
          </span>
          {hasDirty && (
            <span className="text-[10px] font-medium opacity-60">unsaved</span>
          )}
        </div>
      </div>

      {/* Expanded: subject × date grid */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {subjects.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "var(--neo-text-muted)" }}>
              No curriculum defined for {member.year} {member.department}
            </p>
          ) : (
            <div className="neo-scroll-x rounded-xl p-0.5" style={{ background: "var(--neo-bg)" }}>
              <table className="neo-attendance-table" style={{ minWidth: dates.length * 52 + 130 }}>
                <thead>
                  <tr>
                    <th
                      className="text-left text-xs font-bold py-2.5 px-3 sticky left-0 z-10"
                      style={{ background: "var(--neo-bg)", minWidth: 130 }}
                    >
                      Subject
                    </th>
                    {dates.map((date) => (
                      <th
                        key={date}
                        className="text-center text-xs font-bold py-2.5 px-1"
                        style={{ minWidth: 46 }}
                      >
                        {formatDateCol(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.id}>
                      <td
                        className="text-xs font-semibold py-2 px-3 sticky left-0 z-10"
                        style={{ background: "var(--neo-bg)", color: "var(--neo-text)" }}
                      >
                        <span>{subject.subjectName}</span>
                        <span
                          className="ml-1.5 text-[10px] px-1 py-0.5 rounded font-bold opacity-60 border border-current/20"
                        >
                          {subject.type === "Practical" ? "P" : "L"}
                        </span>
                      </td>
                      {dates.map((date) => {
                        const cell = cells[subject.id]?.[date];
                        if (!cell) return <td key={date} />;
                        return (
                          <td key={date} className="text-center py-2 px-1">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                className={`neo-cell ${
                                  cell.state === "no-class"
                                    ? "neo-cell-noclass"
                                    : cell.state === "present"
                                    ? "neo-cell-present"
                                    : "neo-cell-missed"
                                }`}
                                onClick={() => cycleCell(subject.id, date)}
                                title={
                                  cell.state === "no-class"
                                    ? "No class (click for present)"
                                    : cell.state === "present"
                                    ? "Present (click for missed)"
                                    : `Missed ${cell.missed} (click for no class)`
                                }
                              >
                                {cell.state === "no-class"
                                  ? "·"
                                  : cell.state === "present"
                                  ? "—"
                                  : cell.missed}
                              </button>
                              {cell.state === "missed" && (
                                <div className="flex gap-0.5 items-center">
                                  <button
                                    type="button"
                                    className="text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/10 opacity-75 hover:opacity-100 active:opacity-100 transition-opacity"
                                    onClick={() =>
                                      updateMissedCount(
                                        subject.id,
                                        date,
                                        cell.missed - 1
                                      )
                                    }
                                  >
                                    −
                                  </button>
                                  <button
                                    type="button"
                                    className="text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/10 opacity-75 hover:opacity-100 active:opacity-100 transition-opacity"
                                    onClick={() =>
                                      updateMissedCount(
                                        subject.id,
                                        date,
                                        cell.missed + 1
                                      )
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Total missed row */}
                  <tr>
                    <td
                      className="text-xs font-bold py-2.5 px-3 sticky left-0 z-10"
                      style={{
                        background: "var(--neo-bg)",
                        color: "var(--neo-text)",
                        borderTop: "2px solid var(--neo-grid-line)"
                      }}
                    >
                      Total Missed
                    </td>
                    {dates.map((date) => (
                      <td key={date} className="text-center py-2.5 px-1" style={{ borderTop: "2px solid var(--neo-grid-line)" }}>
                        <span
                          className={`neo-badge text-[11px] px-2 py-1 ${
                            totalMissedPerDate[date] === 0
                              ? "neo-badge-good"
                              : "neo-badge-warn"
                          }`}
                        >
                          {totalMissedPerDate[date]}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Note input for any missed cells */}
          {expanded && subjects.length > 0 && (
            <details className="text-xs">
              <summary
                className="cursor-pointer font-medium py-1"
                style={{ color: "var(--neo-text-muted)" }}
              >
                Add notes to missed entries
              </summary>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {subjects.flatMap((subject) =>
                  dates
                    .filter(
                      (date) => cells[subject.id]?.[date]?.state === "missed"
                    )
                    .map((date) => (
                      <div
                        key={`${subject.id}_${date}`}
                        className="flex items-center gap-2"
                      >
                        <span className="shrink-0 opacity-70 w-24 truncate">
                          {subject.subjectName} ({date.slice(5)})
                        </span>
                        <input
                          type="text"
                          className="neo-input flex-1 text-xs h-7"
                          placeholder="Note..."
                          value={cells[subject.id][date].note || ""}
                          onChange={(e) =>
                            updateNote(subject.id, date, e.target.value)
                          }
                        />
                      </div>
                    ))
                )}
              </div>
            </details>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className={`neo-btn flex items-center gap-2 px-5 py-2.5 text-sm ${
                hasDirty ? "animate-unsaved-pulse" : ""
              }`}
              onClick={handleSave}
              disabled={saving || !hasDirty}
              style={{ opacity: saving || !hasDirty ? 0.5 : 1 }}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}