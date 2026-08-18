"use client";

import {
  useVirtualizer,
} from "@tanstack/react-virtual";
import { useRef, useMemo, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: "left" | "center" | "right";
  sticky?: "left" | "right";
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T, index: number) => string;
  rowHeight?: number | ((row: T, index: number) => number);
  height?: number | string;
  width?: number | string;
  overscan?: number;
  emptyMessage?: ReactNode;
  loading?: boolean;
  loadingRows?: number;
  className?: string;
  tableClassName?: string;
  headerClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  cellClassName?: string | ((row: T, index: number, columnKey: string) => string);
  onRowClick?: (row: T, index: number) => void;
  getRowRef?: (row: T, index: number) => React.RefObject<HTMLDivElement> | null;
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowKey,
  rowHeight = 48,
  height = 400,
  width = "100%",
  overscan = 5,
  emptyMessage = "No data available",
  loading = false,
  loadingRows = 5,
  className,
  tableClassName,
  headerClassName,
  rowClassName,
  cellClassName,
  onRowClick,
  getRowRef,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: loading ? loadingRows : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof rowHeight === "function"
      ? (index: number) => (data[index] ? rowHeight(data[index], index) : 48)
      : () => rowHeight,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 48,
    overscan,
    paddingStart: 0,
    paddingEnd: 0,
    horizontal: false,
  });

  const rowVirtualizer = virtualizer;

  const totalWidth = useMemo(() => {
    return columns.reduce((sum, col) => sum + (col.width || col.minWidth || 150), 0);
  }, [columns]);

  if (loading) {
    return (
      <div
        ref={parentRef}
        className={cn("relative overflow-auto", className)}
        style={{ height, width }}
      >
        <div style={{ height: loadingRows * 48, width: totalWidth }}>
          {[...Array(loadingRows)].map((_, i) => (
            <div
              key={i}
              className={cn("h-12 border-b animate-pulse", rowClassName)}
              style={{
                position: "absolute",
                top: i * 48,
                left: 0,
                right: 0,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        ref={parentRef}
        className={cn("relative overflow-auto flex items-center justify-center", className)}
        style={{ height, width }}
      >
        <div className="text-center py-16 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn("relative overflow-auto", className)}
      style={{ height, width }}
      tabIndex={0}
    >
      <div
        className={cn("relative", tableClassName)}
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: totalWidth,
          minWidth: "100%",
        }}
      >
        {/* Header */}
        <div
          className={cn(
            "sticky top-0 z-10 flex border-b bg-muted/50",
            headerClassName
          )}
          style={{ width: totalWidth }}
        >
          {columns.map((column, colIndex) => (
            <div
              key={column.key}
              className={cn(
                "flex items-center px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap overflow-hidden",
                column.align === "center" && "justify-center",
                column.align === "right" && "justify-end",
                column.sticky === "left" && "sticky left-0 z-20 bg-muted/50",
                column.sticky === "right" && "sticky right-0 z-20 bg-muted/50"
              )}
              style={{
                width: column.width || column.minWidth || 150,
                minWidth: column.minWidth,
                maxWidth: column.maxWidth,
              }}
            >
              {column.header}
            </div>
          ))}
        </div>

        {/* Virtualized Rows */}
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const row = data[rowIndex];
          const isLoadingRow = loading && rowIndex >= data.length;

          if (isLoadingRow) {
            return (
              <div
                key={`loading-${rowIndex}`}
                className={cn("h-12 border-b animate-pulse", rowClassName)}
                style={{
                  position: "absolute",
                  top: virtualRow.start,
                  left: 0,
                  right: 0,
                  height: virtualRow.size,
                }}
              />
            );
          }

          const rowRef = getRowRef ? getRowRef(row, rowIndex) : null;

          return (
            <div
              key={rowKey(row, rowIndex)}
              ref={rowRef}
              className={cn(
                "flex border-b transition-colors",
                typeof rowClassName === "function"
                  ? rowClassName(row, rowIndex)
                  : rowClassName,
                onRowClick && "cursor-pointer hover:bg-muted/50"
              )}
              style={{
                position: "absolute",
                top: virtualRow.start,
                left: 0,
                right: 0,
                height: virtualRow.size,
                minHeight: virtualRow.size,
              }}
              onClick={() => onRowClick && onRowClick(row, rowIndex)}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm overflow-hidden",
                    column.align === "center" && "justify-center",
                    column.align === "right" && "justify-end",
                    column.sticky === "left" && "sticky left-0 z-10 bg-card",
                    column.sticky === "right" && "sticky right-0 z-10 bg-card",
                    typeof cellClassName === "function"
                      ? cellClassName(row, rowIndex, column.key)
                      : cellClassName
                  )}
                  style={{
                    width: column.width || column.minWidth || 150,
                    minWidth: column.minWidth,
                    maxWidth: column.maxWidth,
                  }}
                >
                  {column.cell(row, rowIndex)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Simplified VirtualizedList for simpler use cases
interface VirtualizedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemKey: (item: T, index: number) => string;
  itemHeight?: number | ((item: T, index: number) => number);
  height?: number | string;
  width?: number | string;
  overscan?: number;
  emptyMessage?: ReactNode;
  loading?: boolean;
  loadingItems?: number;
  className?: string;
  itemClassName?: string | ((item: T, index: number) => string);
  gap?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

export function VirtualizedList<T>({
  data,
  renderItem,
  itemKey,
  itemHeight = 50,
  height = 400,
  width = "100%",
  overscan = 5,
  emptyMessage = "No items",
  loading = false,
  loadingItems = 5,
  className,
  itemClassName,
  gap = 0,
  paddingTop = 0,
  paddingBottom = 0,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: loading ? loadingItems : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof itemHeight === "function"
      ? (index: number) => (data[index] ? itemHeight(data[index], index) : 50)
      : () => itemHeight,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 50,
    overscan,
    paddingStart: paddingTop,
    paddingEnd: paddingBottom,
    gap,
    horizontal: false,
  });

  const rowVirtualizer = virtualizer;

  if (loading) {
    return (
      <div
        ref={parentRef}
        className={cn("relative overflow-auto", className)}
        style={{ height, width }}
      >
        <div style={{ height: rowVirtualizer.getTotalSize(), width: "100%" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={`loading-${virtualRow.index}`}
              className={cn("animate-pulse", itemClassName)}
              style={{
                position: "absolute",
                top: virtualRow.start,
                left: 0,
                right: 0,
                height: virtualRow.size,
              }}
            >
              <div className="h-full w-full bg-muted/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        ref={parentRef}
        className={cn("relative overflow-auto flex items-center justify-center", className)}
        style={{ height, width }}
      >
        <span className="text-sm text-muted-foreground">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn("relative overflow-auto", className)}
      style={{ height, width }}
      tabIndex={0}
    >
      <div
        className="relative"
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: "100%",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = data[virtualRow.index];
          return (
            <div
              key={itemKey(item, virtualRow.index)}
              className={cn(
                typeof itemClassName === "function"
                  ? itemClassName(item, virtualRow.index)
                  : itemClassName
              )}
              style={{
                position: "absolute",
                top: virtualRow.start,
                left: 0,
                right: 0,
                height: virtualRow.size,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}