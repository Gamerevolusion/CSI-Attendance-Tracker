"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { AttendanceRow } from "@/types";

interface AttendanceGridProps {
  rows: AttendanceRow[];
  lectureCount: number;
  onToggle: (memberIndex: number, lectureIndex: number) => void;
}

export function AttendanceGrid({
  rows,
  lectureCount,
  onToggle,
}: AttendanceGridProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-4 py-3 font-medium min-w-40">
                Member
              </th>
              {Array.from({ length: lectureCount }, (_, i) => (
                <th
                  key={i}
                  className="px-3 py-3 font-medium text-center min-w-12"
                >
                  L{i + 1}
                </th>
              ))}
              <th className="px-4 py-3 font-medium text-center min-w-20">
                Missed
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, memberIndex) => (
              <tr
                key={row.memberId}
                className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <td className="sticky left-0 z-10 bg-card hover:bg-muted/30 px-4 py-3 font-medium">
                  <span className="truncate block max-w-40">
                    {row.memberName}
                  </span>
                </td>
                {row.lectures.map((missed, lectureIndex) => (
                  <td key={lectureIndex} className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={missed}
                        onCheckedChange={() =>
                          onToggle(memberIndex, lectureIndex)
                        }
                        className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                      />
                    </div>
                  </td>
                ))}
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      row.totalMissed === 0
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : row.totalMissed >= lectureCount / 2
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {row.totalMissed}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
