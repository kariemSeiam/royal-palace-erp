import { useState, useEffect } from "react";

export default function InteractiveGantt({ items = [], onDateChange }) {
  const [localItems, setLocalItems] = useState([]);
  useEffect(() => { setLocalItems(items); }, [items]);

  const days = [];
  if (localItems.length > 0) {
    const startDates = localItems.map(i => new Date(i.start_date));
    const endDates = localItems.map(i => new Date(i.end_date));
    const minDate = new Date(Math.min(...startDates));
    const maxDate = new Date(Math.max(...endDates));
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
  }

  const dayWidth = 30;
  const rowHeight = 30;

  function handleDrag(itemId, newStart) {
    const updated = localItems.map(i => i.id === itemId ? { ...i, start_date: newStart } : i);
    setLocalItems(updated);
    if (onDateChange) onDateChange(itemId, newStart);
  }

  if (!localItems.length) return <div>لا توجد بيانات</div>;

  return (
    <div style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #ccc", marginBottom: 4 }}>
        <div style={{ width: 150, fontWeight: 800 }}>المهمة</div>
        {days.map((d, i) => (
          <div key={i} style={{ width: dayWidth, textAlign: "center", fontSize: 10 }}>{d.getDate()}/{d.getMonth()+1}</div>
        ))}
      </div>
      {localItems.map(item => {
        const start = new Date(item.start_date);
        const end = new Date(item.end_date);
        const left = days.findIndex(d => d.toDateString() === start.toDateString()) * dayWidth;
        const width = ((end - start) / (1000*60*60*24) + 1) * dayWidth;
        return (
          <div key={item.id} style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
            <div style={{ width: 150, fontSize: 12 }}>{item.text}</div>
            <div style={{ position: "relative", height: rowHeight, flex: 1 }}>
              <div
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id == item.id) return;
                  alert("اسحب لتغيير التاريخ يدوياً");
                }}
                style={{
                  position: "absolute",
                  left: left,
                  width: width,
                  height: rowHeight - 4,
                  background: item.color || "#3b82f6",
                  borderRadius: 4,
                  color: "#fff",
                  fontSize: 10,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 4,
                  cursor: "grab"
                }}
              >
                {item.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
