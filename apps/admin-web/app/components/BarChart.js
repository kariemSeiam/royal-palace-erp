export default function BarChart({ data, width=200, height=140 }) {
  const max = Math.max(...data.map(d=>d.value), 1);
  const barW = Math.max(8, (width/data.length)-6);
  return (
    <svg width={width} height={height} style={{display:'block', margin:'0 auto'}}>
      {data.map((d,i)=>{ const barH = (d.value/max)*(height-20); const x = i*(barW+4)+2; return <rect key={i} x={x} y={height-barH-15} width={barW} height={barH} fill={d.color||"#3b82f6"} rx={3} />; })}
    </svg>
  );
}
