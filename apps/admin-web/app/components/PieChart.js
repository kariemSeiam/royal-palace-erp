export default function PieChart({ data, size=120 }) {
  const total = data.reduce((s,d)=>s+d.value,0);
  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{display:'block', margin:'0 auto'}}>
      {data.map((d,i)=>{ const startAngle = (cumulative/total)*360; cumulative += d.value; const endAngle = (cumulative/total)*360; const largeArc = endAngle-startAngle>180?1:0; const x1=18+14*Math.cos(Math.PI*(startAngle-90)/180); const y1=18+14*Math.sin(Math.PI*(startAngle-90)/180); const x2=18+14*Math.cos(Math.PI*(endAngle-90)/180); const y2=18+14*Math.sin(Math.PI*(endAngle-90)/180); return <path key={i} d={`M18,18 L${x1},${y1} A14,14 0 ${largeArc} 1 ${x2},${y2} Z`} fill={d.color||"#6b7280"} />; })}
    </svg>
  );
}
