"use client";
import { useState } from "react";

const priorityStars = { low: "⭐", medium: "⭐⭐", high: "⭐⭐⭐" };

export default function KanbanBoard({
  items = [],
  statusField = "stage",
  statusOptions = [],
  statusLabels = {},
  statusColors = {},
  renderCard = () => null,
  onAction = null,
  onDragChange = null,
  stageTotals = {},
  stageMeta = {},
  emptyMessage = "لا توجد عناصر",
}) {
  const [foldedStages, setFoldedStages] = useState({});

  const handleDragStart = (e, item) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: item.id, currentStatus: item[statusField] }));
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    if (raw && onDragChange) {
      const { id, currentStatus } = JSON.parse(raw);
      if (currentStatus !== newStatus) onDragChange(id, newStatus);
    }
  };

  const toggleFold = (status) => {
    setFoldedStages((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const columns = statusOptions.map((status) => ({
    status,
    label: statusLabels[status] || status,
    color: statusColors[status] || "#e2e8f0",
    items: items.filter((item) => item[statusField] === status),
    total: stageTotals[status] ? stageTotals[status].total_value : 0,
    count: stageTotals[status] ? stageTotals[status].count : 0,
    isWon: stageMeta[status]?.is_won || false,
    daysToRot: stageMeta[status]?.days_to_rot || null,
  }));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${statusOptions.length}, minmax(260px, 1fr))`,
        gap: 16,
        overflowX: "auto",
      }}
    >
      {columns.map((col) => {
        const isFolded = foldedStages[col.status];
        return (
          <div
            key={col.status}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.status)}
            style={{
              background: "var(--rp-surface-2)",
              border: col.isWon ? "2px solid #10b981" : "1px solid var(--rp-border)",
              borderRadius: 18,
              padding: 14,
              minHeight: 320,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => toggleFold(col.status)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 800,
                    color: "var(--rp-text)",
                  }}
                >
                  {isFolded ? "▶" : "▼"}
                </button>
                <span style={{ fontWeight: 900 }}>
                  {col.label} ({col.count})
                </span>
                {col.isWon && <span style={{ color: "#10b981", fontSize: 12 }}>🏆 فائزة</span>}
              </div>
              {col.total > 0 && (
                <span style={{ color: "#10b981", fontWeight: 800 }}>
                  {Number(col.total).toLocaleString()} ج.م
                </span>
              )}
            </div>
            {col.daysToRot && (
              <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 8, textAlign: "right" }}>
                ⏳ تنبيه البقاء: {col.daysToRot} يوم
              </div>
            )}
            {!isFolded &&
              col.items.map((item) => {
                const priority = item.priority || "medium";
                const stars = priorityStars[priority] || "";
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    style={{
                      background: "var(--rp-surface)",
                      border: "1px solid var(--rp-border)",
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 8,
                      cursor: "grab",
                    }}
                  >
                    {renderCard ? renderCard(item) : <div>{item.name || item.id}</div>}
                    {stars && <div style={{ fontSize: 12, marginTop: 4 }}>{stars}</div>}
                    {onAction && <div style={{ marginTop: 8 }}>{onAction(item)}</div>}
                  </div>
                );
              })}
            {!isFolded && col.items.length === 0 && (
              <div className="erp-mini-note" style={{ textAlign: "center", marginTop: 40 }}>
                {emptyMessage}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
