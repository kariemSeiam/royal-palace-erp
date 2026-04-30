"use client";

import { useMemo } from "react";

function daysBetween(start, end) {
  if (!start || !end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
}

export default function GanttChart({
  items = [],
  idField = "id",
  nameField = "name",
  startField = "planned_start_date",
  endField = "planned_end_date",
  progressField = "progress_percent",
  assigneeField = "assigned_to_user_id",
  colorField = null,
  onItemClick = null,
  emptyMessage = "لا توجد مهام",
}) {
  const chartData = useMemo(() => {
    if (!items.length) return { minDate: new Date(), maxDate: new Date(), totalDays: 30, rows: [] };

    const allStarts = items.map((item) => new Date(item[startField] || new Date()));
    const allEnds = items.map((item) => new Date(item[endField] || addDays(new Date(), 7)));

    const minDate = new Date(Math.min(...allStarts));
    const maxDate = new Date(Math.max(...allEnds));
    const totalDays = Math.max(30, daysBetween(minDate, maxDate) + 14);

    const rows = items.map((item) => {
      const start = new Date(item[startField] || minDate);
      const end = new Date(item[endField] || addDays(start, 7));
      const progress = Number(item[progressField] || 0);
      const offsetDays = daysBetween(minDate, start);
      const durationDays = daysBetween(start, end);
      const leftPercent = (offsetDays / totalDays) * 100;
      const widthPercent = Math.max(2, (durationDays / totalDays) * 100);

      return {
        id: item[idField],
        name: item[nameField] || "-",
        start,
        end,
        progress,
        assignee: item[assigneeField] || "-",
        color: colorField ? item[colorField] : "#3b82f6",
        leftPercent,
        widthPercent,
        raw: item,
      };
    });

    return { minDate, maxDate, totalDays, rows };
  }, [items, idField, nameField, startField, endField, progressField, assigneeField, colorField]);

  if (!chartData.rows.length) {
    return (
      <div className="erp-mini-note" style={{ textAlign: "center", padding: "40px" }}>
        {emptyMessage}
      </div>
    );
  }

  const monthMarkers = [];
  const current = new Date(chartData.minDate);
  while (current <= chartData.maxDate) {
    monthMarkers.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "18px", background: "var(--rp-surface)" }}>
      <div style={{ minWidth: "800px" }}>
        {/* Month header */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--rp-border)", background: "var(--rp-surface-2)", borderRadius: "18px 18px 0 0" }}>
          <div style={{ minWidth: "200px", padding: "10px 14px", fontWeight: 900, fontSize: "13px", borderInlineEnd: "1px solid var(--rp-border)" }}>المهمة</div>
          <div style={{ flex: 1, display: "flex", position: "relative" }}>
            {monthMarkers.map((m, i) => {
              const leftPercent = ((daysBetween(chartData.minDate, m) / chartData.totalDays) * 100).toFixed(1);
              return (
                <div key={i} style={{ position: "absolute", left: `${leftPercent}%`, padding: "10px 4px", fontSize: "11px", fontWeight: 700, color: "var(--rp-text-muted)", whiteSpace: "nowrap" }}>
                  {m.toLocaleDateString("ar-EG", { month: "short", year: "numeric" })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        {chartData.rows.map((row) => (
          <div
            key={row.id}
            style={{ display: "flex", borderBottom: "1px solid var(--rp-border)", cursor: onItemClick ? "pointer" : "default", minHeight: "48px", alignItems: "center" }}
            onClick={() => onItemClick && onItemClick(row.raw)}
          >
            <div style={{ minWidth: "200px", padding: "10px 14px", fontSize: "13px", fontWeight: 700, borderInlineEnd: "1px solid var(--rp-border)", display: "grid", gap: "2px" }}>
              <span>{row.name}</span>
              <span style={{ fontSize: "10px", color: "var(--rp-text-muted)" }}>{row.assignee || "-"}</span>
            </div>
            <div style={{ flex: 1, position: "relative", padding: "8px 0" }}>
              {/* Grid lines */}
              {Array.from({ length: Math.ceil(chartData.totalDays / 7) }).map((_, i) => {
                const leftPercent = ((i * 7) / chartData.totalDays * 100).toFixed(1);
                return (
                  <div key={i} style={{ position: "absolute", left: `${leftPercent}%`, top: 0, bottom: 0, width: "1px", background: "var(--rp-border)" }} />
                );
              })}
              {/* Bar */}
              <div
                style={{
                  position: "absolute",
                  left: `${row.leftPercent}%`,
                  width: `${row.widthPercent}%`,
                  top: "8px",
                  bottom: "8px",
                  borderRadius: "10px",
                  background: `linear-gradient(135deg, ${row.color}, ${row.color}dd)`,
                  display: "flex",
                  alignItems: "center",
                  minWidth: "20px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              >
                {/* Progress fill */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(100, row.progress)}%`,
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.25)",
                  }}
                />
                <span style={{ position: "relative", zIndex: 1, padding: "0 8px", fontSize: "10px", fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>
                  {formatDate(row.start)} - {formatDate(row.end)} ({row.progress}%)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
