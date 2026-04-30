"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const API_BASE = "https://api.royalpalace-group.com/api/v1/admin/crm";
const FACTORIES_API = "https://api.royalpalace-group.com/api/v1/admin/factories";
const apiUrl = (path) => `${API_BASE}${path}`;

const OPP_STAGES = ["qualification","needs_analysis","proposal","negotiation","closed_won","closed_lost"];
const OPP_STAGE_LABELS = { qualification:"تأهيل", needs_analysis:"احتياج", proposal:"عرض سعر", negotiation:"تفاوض", closed_won:"ناجح", closed_lost:"خاسر" };
const OPP_STAGE_COLORS = { qualification:"#3b82f6", needs_analysis:"#8b5cf6", proposal:"#f59e0b", negotiation:"#f97316", closed_won:"#10b981", closed_lost:"#6b7280" };
const LEAD_STATUSES = ["new","qualified","contacted","converted","closed"];
const LEAD_STATUS_LABELS = { new:"جديد", qualified:"مؤهل", contacted:"تم التواصل", converted:"محول", closed:"مغلق" };
const LEAD_STATUS_COLORS = { new:"#3b82f6", qualified:"#8b5cf6", contacted:"#f59e0b", converted:"#10b981", closed:"#6b7280" };
const ACTIVITY_TYPES = ["task","call","meeting","email","other"];
const ACTIVITY_TYPE_LABELS = { task:"مهمة", call:"مكالمة", meeting:"اجتماع", email:"بريد", other:"أخرى" };
const ACTIVITY_TYPE_COLORS = { task:"#3b82f6", call:"#f59e0b", meeting:"#10b981", email:"#8b5cf6", other:"#6b7280" };
const NOTE_TYPES = ["comment","email","call","note"];
const NOTE_TYPE_LABELS = { comment:"تعليق", email:"بريد", call:"مكالمة", note:"ملاحظة" };
const NOTE_TYPE_COLORS = { comment:"#6b7280", email:"#3b82f6", call:"#f59e0b", note:"#8b5cf6" };

const btnStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };
function fmt(v) { return Number(v||0).toLocaleString("ar-EG"); }

const priorityStars = { low:"⭐", medium:"⭐⭐", high:"⭐⭐⭐" };

function OppCard({ opp }) { if (!opp) return null; const stars = priorityStars[opp.priority] || ""; return (<div><div style={{fontWeight:900, fontSize:14}}>{opp.name||"-"}</div><div style={{fontSize:12, color:"var(--rp-text-muted)"}}>{opp.company_name||"-"} {stars}</div><div style={{fontSize:11, marginTop:4}}>الإيراد: {fmt(opp.expected_revenue)}</div></div>); }
function LeadCard({ lead }) { if (!lead) return null; const stars = priorityStars[lead.priority] || ""; return (<div><div style={{fontWeight:900, fontSize:14}}>{lead.contact_name||"-"} {stars}</div><div style={{fontSize:12, color:"var(--rp-text-muted)"}}>{lead.company_name||"-"}</div><div style={{fontSize:11}}>{lead.phone||lead.mobile||""}</div></div>); }
function ActivityCard({ act }) { if (!act) return null; return (<div><div style={{fontWeight:900, fontSize:14}}>{act.subject||"-"}</div><div style={{fontSize:12, color:"var(--rp-text-muted)"}}>{act.activity_type}</div><div style={{fontSize:11}}>{act.due_date?.split("T")[0]}</div></div>); }
function NoteCard({ note }) { if (!note) return null; return (<div><div style={{fontWeight:900, fontSize:14}}>{note.title||"-"}</div><div style={{fontSize:12, color:"var(--rp-text-muted)"}}>{note.note_type}</div><div style={{fontSize:11}}>{note.content?.substring(0,60)}</div></div>); }

function CalendarView({ activities, opps, onExportCsv, onExportPdf, onExportExcel }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const today = new Date(); today.setHours(0,0,0,0);
  const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const getEventsForDay = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayActs = activities.filter(a => a.due_date && a.due_date.startsWith(dateStr));
    const dayOpps = opps.filter(o => o.expected_closing_date && o.expected_closing_date.startsWith(dateStr));
    return [...dayActs.map(a=>({...a, type:'activity'})), ...dayOpps.map(o=>({...o, type:'opportunity'}))];
  };
  return (<div className="erp-section-card" style={{marginTop:18}}>
    <div className="erp-section-head"><h3>التقويم</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={onExportCsv}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={onExportExcel}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={onExportPdf}>PDF</button></div></div>
    <div style={{background:'var(--rp-surface)', borderRadius:24, padding:16, border:'1px solid var(--rp-border)'}}>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:16, alignItems:'center'}}>
        <button className="erp-btn-secondary" onClick={()=>{ if(currentMonth===0){ setCurrentMonth(11); setCurrentYear(y=>y-1); } else setCurrentMonth(m=>m-1); }}>‹</button>
        <h3 style={{margin:0}}>{monthNames[currentMonth]} {currentYear}</h3>
        <button className="erp-btn-secondary" onClick={()=>{ if(currentMonth===11){ setCurrentMonth(0); setCurrentYear(y=>y+1); } else setCurrentMonth(m=>m+1); }}>›</button>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, textAlign:'center', fontWeight:800, marginBottom:8}}>{["أحد","إثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"].map(d=><div key={d}>{d}</div>)}</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4}}>
        {Array.from({length: firstDayOfMonth}).map((_,i)=><div key={`empty-${i}`} />)}
        {Array.from({length: daysInMonth}, (_,i)=>i+1).map(day=>{
          const events = getEventsForDay(day);
          const isToday = today.getDate()===day && today.getMonth()===currentMonth && today.getFullYear()===currentYear;
          return (<div key={day} style={{minHeight:70, border:'1px solid var(--rp-border)', borderRadius:10, padding:4, background: isToday?'var(--rp-primary-soft)':'transparent'}}><div style={{fontWeight:800, fontSize:14}}>{day}</div>{events.slice(0,3).map((ev,idx)=><div key={idx} style={{fontSize:9, background: ev.type==='activity'?'#3b82f6':'#f59e0b', color:'#fff', borderRadius:4, padding:'1px 4px', marginBottom:2}}>{ev.subject||ev.name}</div>)}</div>);
        })}
      </div>
    </div>
  </div>);
}

function BarChart({ data, width=200, height=140 }) {
  const max = Math.max(...data.map(d=>d.value), 1);
  const barW = Math.max(8, (width/data.length)-6);
  return (<svg width={width} height={height} style={{display:'block', margin:'0 auto'}}>
    {data.map((d,i)=>{ const barH = (d.value/max)*(height-20); const x = i*(barW+4)+2; return <rect key={i} x={x} y={height-barH-15} width={barW} height={barH} fill={d.color||"#3b82f6"} rx={3} />; })}
  </svg>);
}

function PieChart({ data, size=120 }) {
  const total = data.reduce((s,d)=>s+d.value,0);
  let cumulative = 0;
  return (<svg width={size} height={size} viewBox="0 0 36 36" style={{display:'block', margin:'0 auto'}}>
    {data.map((d,i)=>{ const startAngle = (cumulative/total)*360; cumulative += d.value; const endAngle = (cumulative/total)*360; const largeArc = endAngle-startAngle>180?1:0; const x1=18+14*Math.cos(Math.PI*(startAngle-90)/180); const y1=18+14*Math.sin(Math.PI*(startAngle-90)/180); const x2=18+14*Math.cos(Math.PI*(endAngle-90)/180); const y2=18+14*Math.sin(Math.PI*(endAngle-90)/180); return <path key={i} d={`M18,18 L${x1},${y1} A14,14 0 ${largeArc} 1 ${x2},${y2} Z`} fill={d.color||"#6b7280"} />; })}
  </svg>);
}

function LineChart({ data, width=400, height=200 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d=>d.value), 1);
  const stepX = width / (data.length - 1);
  const points = data.map((d,i) => `${i * stepX},${height - (d.value/max)*(height-20) - 10}`).join(" ");
  return (<svg width={width} height={height} style={{display:'block', margin:'0 auto'}}>
    <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={points} />
    {data.map((d,i) => <circle key={i} cx={i*stepX} cy={height - (d.value/max)*(height-20) - 10} r="3" fill="#3b82f6" />)}
  </svg>);
}

function DashboardView({ leads, opps, activities, pipeline, onExportCsv, onExportPdf, onExportExcel }) {
  const totalLeads = leads.length;
  const totalOpps = opps.length;
  const totalValue = pipeline.reduce((s,i)=>s+i.total_value,0);
  const openActs = activities.filter(a=>!a.is_done).length;
  const won = opps.filter(o=>o.stage==='closed_won').length;
  const conversion = totalLeads>0?Math.round((won/totalLeads)*100):0;
  const barData = pipeline.map(s=>({value:s.total_value, color:OPP_STAGE_COLORS[s.stage]||"#6b7280"}));
  const pieData = pipeline.map(s=>({value:s.count, color:OPP_STAGE_COLORS[s.stage]||"#6b7280"}));
  return (<div className="erp-section-card" style={{marginTop:18}}>
    <div className="erp-section-head"><h3>لوحة التحكم</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={onExportCsv}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={onExportExcel}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={onExportPdf}>PDF</button></div></div>
    <div style={{display:'grid',gap:16}}>
      <div className="erp-kpi-grid">
        <div className="erp-card"><div className="erp-card-title">عملاء</div><div className="erp-card-value">{totalLeads}</div></div>
        <div className="erp-card"><div className="erp-card-title">فرص</div><div className="erp-card-value">{totalOpps}</div></div>
        <div className="erp-card"><div className="erp-card-title">قيمة الخط</div><div className="erp-card-value">{fmt(totalValue)}</div></div>
        <div className="erp-card"><div className="erp-card-title">أنشطة مفتوحة</div><div className="erp-card-value">{openActs}</div></div>
        <div className="erp-card"><div className="erp-card-title">تحويل</div><div className="erp-card-value">{conversion}%</div></div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        <div className="erp-section-card"><h4>قيمة الفرص حسب المرحلة</h4><BarChart data={barData} /></div>
        <div className="erp-section-card"><h4>عدد الفرص حسب المرحلة</h4><PieChart data={pieData} /></div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        <div className="erp-section-card"><h4>الأنشطة القادمة</h4>{activities.filter(a=>!a.is_done&&a.due_date).sort((a,b)=>a.due_date?.localeCompare(b.due_date)).slice(0,8).map(a=>(<div key={a.id} style={{padding:'6px 0', borderBottom:'1px solid var(--rp-border)', display:'flex', justifyContent:'space-between'}}><span>{a.subject}</span><span style={{fontSize:12, color:'var(--rp-text-muted)'}}>{a.due_date?.split('T')[0]}</span></div>))}</div>
        <div className="erp-section-card"><h4>آخر الفرص المضافة</h4>{opps.slice(0,8).map(o=>(<div key={o.id} style={{padding:'6px 0', borderBottom:'1px solid var(--rp-border)', display:'flex', justifyContent:'space-between'}}><span>{o.name}</span><span style={{fontSize:12}}>{fmt(o.expected_revenue)}</span></div>))}</div>
      </div>
    </div>
  </div>);
}

function PivotView({ opps, onExportCsv, onExportPdf, onExportExcel }) {
  const [rowField, setRowField] = useState("stage");
  const [colField, setColField] = useState("month");
  const pivot = useMemo(()=>{
    const map = {};
    opps.forEach(o=>{
      const rv = rowField==="stage"? (o.stage||"unknown") : (o.priority||"unknown");
      const cv = colField==="month"? (o.created_at?o.created_at.substring(0,7):"unknown") : (o.assigned_to_user_id||"unknown");
      const k = `${rv}|||${cv}`;
      if(!map[k]) map[k]={row:rv, col:cv, count:0, value:0};
      map[k].count++; map[k].value += o.expected_revenue||0;
    });
    return Object.values(map);
  }, [opps, rowField, colField]);
  return (<div className="erp-section-card" style={{marginTop:18}}>
    <div className="erp-section-head"><h3>تحليل محوري</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={onExportCsv}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={onExportExcel}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={onExportPdf}>PDF</button></div></div>
    <div style={{display:'flex', gap:12, marginBottom:12}}>
      <select className="erp-input" value={rowField} onChange={e=>setRowField(e.target.value)}><option value="stage">المرحلة</option><option value="priority">الأولوية</option></select>
      <select className="erp-input" value={colField} onChange={e=>setColField(e.target.value)}><option value="month">الشهر</option><option value="assigned_to_user_id">المسؤول</option></select>
    </div>
    <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>{rowField==="stage"?"المرحلة":"الأولوية"}</th><th>{colField==="month"?"الشهر":"المسؤول"}</th><th>عدد الفرص</th><th>القيمة</th></tr></thead><tbody>{pivot.map((r,i)=><tr key={i}><td>{r.row}</td><td>{r.col}</td><td>{r.count}</td><td>{fmt(r.value)}</td></tr>)}</tbody></table></div>
  </div>);
}

function StageManager({ stages, onSave, onDelete, onUpdateAutomation, onExportCsv, onExportPdf, onExportExcel }) {
  const [newName, setNewName] = useState("");
  const [selectedStage, setSelectedStage] = useState(null);
  const handleAdd = () => { if(newName.trim()) { onSave(newName); setNewName(""); } };
  const openAutomation = (stage) => setSelectedStage(stage);
  return (<div className="erp-section-card" style={{marginTop:18}}>
    <div className="erp-section-head"><h3>إدارة المراحل</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={onExportCsv}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={onExportExcel}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={onExportPdf}>PDF</button></div></div>
    <div style={{display:'flex', gap:8, marginBottom:12}}>
      <input className="erp-input" placeholder="اسم المرحلة الجديدة" value={newName} onChange={e=>setNewName(e.target.value)} />
      <button className="erp-btn-primary" style={btnStyle} onClick={handleAdd}>إضافة</button>
    </div>
    <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>الاسم</th><th>الترتيب</th><th>Is Won</th><th>Days to Rot</th><th>متطلبات</th><th>أتمتة</th><th></th></tr></thead><tbody>{stages.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.sequence}</td><td>{s.is_won ? "✅" : "❌"}</td><td>{s.days_to_rot || "-"}</td><td>{s.requirements||"-"}</td><td>{s.automation_action ? `${s.automation_trigger} -> ${s.automation_action}` : "لا يوجد"}</td><td><div style={{display:'flex',gap:6}}><button className="erp-btn-secondary" style={{fontSize:12}} onClick={()=>openAutomation(s)}>أتمتة</button><button className="erp-btn-danger" style={{fontSize:12}} onClick={()=>onDelete(s.id)}>حذف</button></div></td></tr>)}</tbody></table></div>
    {selectedStage && (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
        <div style={{background:'white',borderRadius:24,padding:24,width:480,maxWidth:'90%'}}>
          <h3>أتمتة المرحلة: {selectedStage.name}</h3>
          <form onSubmit={async (e)=>{ e.preventDefault(); const data = { requirements: e.target.requirements.value, automation_trigger: e.target.automation_trigger.value, automation_action: e.target.automation_action.value, is_won: e.target.is_won.checked, days_to_rot: e.target.days_to_rot.value }; await onUpdateAutomation(selectedStage.id, data); setSelectedStage(null); }} style={{display:'grid',gap:12}}>
            <textarea className="erp-input" rows="2" placeholder="متطلبات المرحلة (نص)" name="requirements" defaultValue={selectedStage.requirements||""}/>
            <select className="erp-input" name="automation_trigger" defaultValue={selectedStage.automation_trigger||""}>
              <option value="">بدون مشغّل</option>
              <option value="on_enter">عند الدخول إلى المرحلة</option>
              <option value="on_leave">عند مغادرة المرحلة</option>
            </select>
            <select className="erp-input" name="automation_action" defaultValue={selectedStage.automation_action||""}>
              <option value="">بدون إجراء</option>
              <option value="create_activity">إنشاء نشاط</option>
              <option value="send_email">إرسال بريد</option>
            </select>
            <label className="erp-check"><input type="checkbox" name="is_won" defaultChecked={selectedStage.is_won||false} /><span>مرحلة فائزة (Is Won)</span></label>
            <input className="erp-input" type="number" name="days_to_rot" placeholder="أيام البقاء (Days to Rot)" defaultValue={selectedStage.days_to_rot||""} />
            <div style={{display:'flex',gap:8}}>
              <button className="erp-btn-primary" type="submit">حفظ</button>
              <button className="erp-btn-secondary" type="button" onClick={()=>setSelectedStage(null)}>إلغاء</button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>);
}

function ForecastView({ forecast, onExportCsv, onExportPdf, onExportExcel }) {
  const maxVal = Math.max(...forecast.map(d=>d.forecast_value), 1);
  return (<div className="erp-section-card" style={{marginTop:18}}>
    <div className="erp-section-head"><h3>التنبؤ بالإيرادات</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={onExportCsv}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={onExportExcel}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={onExportPdf}>PDF</button></div></div>
    <div style={{display:'flex', alignItems:'flex-end', gap:16, marginTop:16, padding:'8px 0', overflowX:'auto', maxWidth:'100%'}}>
      {forecast.map((d,i)=>(
        <div key={i} style={{flex:'0 0 80px', textAlign:'center'}}>
          <div style={{height:100, display:'flex', alignItems:'flex-end', justifyContent:'center', marginBottom:8}}>
            <div style={{width:28, height:`${maxVal>0?(d.forecast_value/maxVal)*100:0}%`, background:'#3b82f6', borderRadius:'6px 6px 0 0', minHeight:4}} title={fmt(d.forecast_value)}></div>
          </div>
          <span style={{fontSize:11, fontWeight:800}}>{d.month}</span>
          <div style={{fontSize:10, color:'var(--rp-text-muted)'}}>{fmt(d.forecast_value)}</div>
        </div>
      ))}
    </div>
  </div>);
}

function GraphView({ graphData, onExportCsv, onExportPdf, onExportExcel }) {
  const lineData = graphData.map(d=>({value:d.value}));
  return (<div className="erp-section-card" style={{marginTop:18}}>
    <div className="erp-section-head"><h3>الرسوم البيانية</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={onExportCsv}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={onExportExcel}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={onExportPdf}>PDF</button></div></div>
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <div className="erp-section-card"><h4>شريطي</h4><BarChart data={graphData.map(d=>({value:d.value, color:OPP_STAGE_COLORS[d.label]||"#6b7280"}))} width={300} height={200} /></div>
      <div className="erp-section-card"><h4>خطي</h4><LineChart data={lineData} width={300} height={200} /></div>
    </div>
    <div style={{marginTop:8, textAlign:'center'}}>
      {graphData.map((d,i)=><span key={i} style={{margin:'0 8px', fontSize:12}}><span style={{display:'inline-block', width:10, height:10, borderRadius:2, background:OPP_STAGE_COLORS[d.label]||"#6b7280", marginRight:4}}></span>{d.label} ({d.value})</span>)}
    </div>
  </div>);
}

function LeadAnalysisView({ leadAnalysis, onExportCsv, onExportPdf, onExportExcel }) {
  if (!leadAnalysis) return <div className="erp-section-card" style={{marginTop:18}}><div className="erp-section-head"><h3>تحليل العملاء</h3></div><div className="erp-form-message">لا توجد بيانات كافية حالياً.</div></div>;
  const sourceRows = leadAnalysis.sources||[];
  const statusRows = leadAnalysis.statuses||[];
  return (<div className="erp-section-card" style={{marginTop:18}}>
    <div className="erp-section-head"><h3>تحليل العملاء</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={onExportCsv}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={onExportExcel}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={onExportPdf}>PDF</button></div></div>
    <div style={{display:'grid', gap:16}}>
      <div className="erp-section-card">
        <h4>حسب المصدر</h4>
        <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>المصدر</th><th>العدد</th></tr></thead><tbody>{sourceRows.map((s,i)=><tr key={i}><td>{s.source}</td><td>{s.count}</td></tr>)}</tbody></table></div>
      </div>
      <div className="erp-section-card">
        <h4>حسب الحالة</h4>
        <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>الحالة</th><th>العدد</th></tr></thead><tbody>{statusRows.map((s,i)=><tr key={i}><td>{LEAD_STATUS_LABELS[s.status]||s.status}</td><td>{s.count}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  </div>);
}

function AutomationRulesView({ rules, onAdd, onDelete, onExportCsv, onExportPdf, onExportExcel }) {
  const [newRule, setNewRule] = useState({name:"", trigger_field:"", trigger_value:"", action_type:"", action_config:"{}"});
  const handleAdd = async (e) => {
    e.preventDefault();
    if(!newRule.name||!newRule.trigger_field||!newRule.trigger_value||!newRule.action_type) return;
    const payload = {...newRule, action_config: JSON.parse(newRule.action_config || "{}")};
    await onAdd(payload);
    setNewRule({name:"", trigger_field:"", trigger_value:"", action_type:"", action_config:"{}"});
  };
  return (<div className="erp-section-card" style={{marginTop:18}}>
    <div className="erp-section-head"><h3>قواعد الأتمتة</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={onExportCsv}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={onExportExcel}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={onExportPdf}>PDF</button></div></div>
    <form onSubmit={handleAdd} style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:16, alignItems:'flex-end'}}>
      <input className="erp-input" style={{flex:'1 1 180px'}} placeholder="اسم القاعدة" value={newRule.name} onChange={e=>setNewRule({...newRule, name:e.target.value})} required />
      <input className="erp-input" style={{flex:'1 1 140px'}} placeholder="الحقل (status)" value={newRule.trigger_field} onChange={e=>setNewRule({...newRule, trigger_field:e.target.value})} required />
      <input className="erp-input" style={{flex:'1 1 140px'}} placeholder="قيمته (new)" value={newRule.trigger_value} onChange={e=>setNewRule({...newRule, trigger_value:e.target.value})} required />
      <input className="erp-input" style={{flex:'1 1 160px'}} placeholder="الإجراء (create_activity)" value={newRule.action_type} onChange={e=>setNewRule({...newRule, action_type:e.target.value})} required />
      <textarea className="erp-input" rows="1" style={{flex:'1 1 200px'}} placeholder="JSON config" value={newRule.action_config} onChange={e=>setNewRule({...newRule, action_config:e.target.value})} />
      <button className="erp-btn-primary" type="submit">إضافة</button>
    </form>
    <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>الاسم</th><th>المحفز</th><th>الإجراء</th><th></th></tr></thead><tbody>{rules.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.trigger_field} = {r.trigger_value}</td><td>{r.action_type}</td><td><button className="erp-btn-danger" style={{fontSize:12}} onClick={()=>onDelete(r.id)}>حذف</button></td></tr>)}</tbody></table></div>
  </div>);
}

export function exportTableXlsx(filename, headers, rows) {
  if (typeof window === "undefined") return;
  import("xlsx").then((XLSX) => {
    const sheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  });
}

export default function CrmPage() {
  const {user, ready} = useAdminAuth("crm");
  const [leads, setLeads] = useState([]);
  const [opps, setOpps] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [stages, setStages] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [leadAnalysis, setLeadAnalysis] = useState(null);
  const [automationRules, setAutomationRules] = useState([]);
  const [factories, setFactories] = useState([]);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("leads");
  const [view, setView] = useState({ leads:"table", opps:"kanban", activities:"table", notes:"table" });
  const [busy, setBusy] = useState(false);
  const [leadForm, setLeadForm] = useState({ contact_name:"", company_name:"", email:"", phone:"", mobile:"", address:"", city:"", country:"", source:"", priority:"medium", factory_id:"", notes:"", contact_id:"" });
  const [editLeadId, setEditLeadId] = useState(null);
  const [actForm, setActForm] = useState({ subject:"", activity_type:"task", due_date:"", lead_id:"", opportunity_id:"", notes:"" });
  const [noteForm, setNoteForm] = useState({ target_type:"lead", target_id:"", title:"", content:"", note_type:"comment" });
  const [contactForm, setContactForm] = useState({ full_name:"", company_name:"", email:"", phone:"", mobile:"", address:"", city:"", country:"", job_title:"", notes:"" });
  const [editContactId, setEditContactId] = useState(null);
  const [convertModal, setConvertModal] = useState({ open:false, leadId:null, name:"", expected_revenue:"", stage:"qualification" });

  async function loadAll() {
    try {
      const [l,o,c,a,n,p,s,f,fc,g,la,ar] = await Promise.all([
        fetch(apiUrl("/leads"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/opportunities"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/contacts"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/activities"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/notes"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/pipeline-report"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/pipeline-stages"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(FACTORIES_API,{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/forecast"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/graph-data"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/lead-analysis"),{headers:authHeaders()}).then(r=>r.json()),
        fetch(apiUrl("/automation-rules"),{headers:authHeaders()}).then(r=>r.json()),
      ]);
      setLeads(Array.isArray(l) ? l.filter(Boolean) : []);
      setOpps(Array.isArray(o) ? o.filter(i=>i&&typeof i==='object') : []);
      setContacts(Array.isArray(c) ? c.filter(Boolean) : []);
      setActivities(Array.isArray(a) ? a.filter(Boolean) : []);
      setNotes(Array.isArray(n) ? n.filter(Boolean) : []);
      setPipeline(Array.isArray(p) ? p.filter(Boolean) : []);
      setStages(Array.isArray(s) ? s : []);
      setForecast(Array.isArray(fc) ? fc : []);
      setGraphData(Array.isArray(g) ? g : []);
      setLeadAnalysis(la || null);
      setAutomationRules(Array.isArray(ar) ? ar : []);
      setFactories(Array.isArray(f) ? f : []);
    } catch(e) { setMsg(e.message); }
  }
  useEffect(()=>{ if(ready&&user) loadAll(); },[ready,user]);

  const stageMeta = useMemo(() => {
    const m = {};
    stages.forEach(s => { m[s.name] = { is_won: s.is_won || false, days_to_rot: s.days_to_rot || null }; });
    return m;
  }, [stages]);

  const stageTotals = useMemo(()=>{ const m={}; pipeline.forEach(s=>{ m[s.stage]={total_value:s.total_value,count:s.count}; }); return m; }, [pipeline]);
  function setViewMode(t,m) { setView(p=>({...p, [t]:m})); }

  async function saveContact(e) { e.preventDefault(); setBusy(true); setMsg(""); try { const url = editContactId ? apiUrl(`/contacts/${editContactId}`) : apiUrl("/contacts"); const method = editContactId ? "PUT" : "POST"; const res = await fetch(url,{method,headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify(contactForm)}); if(!res.ok) throw new Error((await res.json()).detail); setMsg(editContactId?"تم تعديل جهة الاتصال":"تم إضافة جهة الاتصال"); setContactForm({full_name:"",company_name:"",email:"",phone:"",mobile:"",address:"",city:"",country:"",job_title:"",notes:""}); setEditContactId(null); loadAll(); } catch(e) { setMsg(e.message); } finally { setBusy(false); } }
  function editContact(c) { setEditContactId(c.id); setContactForm({full_name:c.full_name||"", company_name:c.company_name||"", email:c.email||"", phone:c.phone||"", mobile:c.mobile||"", address:c.address||"", city:c.city||"", country:c.country||"", job_title:c.job_title||"", notes:c.notes||""}); }
  async function delContact(id) { if(!confirm("حذف جهة الاتصال؟")) return; await fetch(apiUrl(`/contacts/${id}`),{method:"DELETE",headers:authHeaders()}); loadAll(); }

  async function saveLead(e) { e.preventDefault(); setBusy(true); setMsg(""); const payload = { ...leadForm, contact_id: leadForm.contact_id?Number(leadForm.contact_id):null, factory_id: leadForm.factory_id?Number(leadForm.factory_id):null }; const url = editLeadId ? apiUrl(`/leads/${editLeadId}`) : apiUrl("/leads"); const method = editLeadId?"PUT":"POST"; try { const res = await fetch(url,{method,headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify(payload)}); if(!res.ok) throw new Error((await res.json()).detail); setMsg(editLeadId?"تم التعديل":"تم الإنشاء"); setLeadForm({contact_name:"",company_name:"",email:"",phone:"",mobile:"",address:"",city:"",country:"",source:"",priority:"medium",factory_id:"",notes:"",contact_id:""}); setEditLeadId(null); loadAll(); } catch(e) { setMsg(e.message); } finally { setBusy(false); } }
  function editLead(l) { setEditLeadId(l.id); setLeadForm({...l, contact_id:l.contact_id||"", factory_id:l.factory_id||""}); }
  async function delLead(id) { if(!confirm("حذف؟"))return; await fetch(apiUrl(`/leads/${id}`),{method:"DELETE",headers:authHeaders()}); loadAll(); }
  function openConvertModal(lead) { setConvertModal({ open:true, leadId:lead.id, name:`${lead.company_name||lead.contact_name} - Opportunity`, expected_revenue:"", stage:"qualification" }); }
  async function handleConvertSubmit(e) { e.preventDefault(); setBusy(true); setMsg(""); try { await fetch(apiUrl(`/leads/${convertModal.leadId}/convert`),{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify({name:convertModal.name, expected_revenue:Number(convertModal.expected_revenue), stage:convertModal.stage})}); setMsg("تم التحويل إلى فرصة بنجاح"); setConvertModal({open:false, leadId:null, name:"", expected_revenue:"", stage:"qualification"}); loadAll(); } catch(e) { setMsg(e.message); } finally { setBusy(false); } }

  async function saveActivity(e) { e.preventDefault(); setBusy(true); setMsg(""); try { const payload = {subject:actForm.subject, activity_type:actForm.activity_type, due_date:actForm.due_date||null, lead_id:actForm.lead_id?Number(actForm.lead_id):null, opportunity_id:actForm.opportunity_id?Number(actForm.opportunity_id):null, notes:actForm.notes||null}; const res = await fetch(apiUrl("/activities"),{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify(payload)}); if(!res.ok) throw new Error((await res.json()).detail); setActForm({subject:"",activity_type:"task",due_date:"",lead_id:"",opportunity_id:"",notes:""}); loadAll(); } catch(e) { setMsg(e.message); } finally { setBusy(false); } }
  async function toggleDone(id, done) { await fetch(apiUrl(`/activities/${id}`),{method:"PUT",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify({is_done:done})}); loadAll(); }
  async function delActivity(id) { if(!confirm("حذف النشاط؟")) return; await fetch(apiUrl(`/activities/${id}`),{method:"DELETE",headers:authHeaders()}); loadAll(); }

  async function changeStage(id, stage) { await fetch(apiUrl(`/opportunities/${id}/stage`),{method:"PATCH",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify({stage})}); loadAll(); }
  async function delOpp(id) { if(!confirm("حذف الفرصة؟"))return; await fetch(apiUrl(`/opportunities/${id}`),{method:"DELETE",headers:authHeaders()}); loadAll(); }

  async function saveNote(e) { e.preventDefault(); setBusy(true); setMsg(""); try { const payload = {title:noteForm.title, content:noteForm.content, note_type:noteForm.note_type, [noteForm.target_type==="lead"?"lead_id":"opportunity_id"]: Number(noteForm.target_id)}; const res = await fetch(apiUrl("/notes"),{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify(payload)}); if(!res.ok) throw new Error((await res.json()).detail); setNoteForm({target_type:"lead",target_id:"",title:"",content:"",note_type:"comment"}); loadAll(); } catch(e) { setMsg(e.message); } finally { setBusy(false); } }
  async function delNote(id) { await fetch(apiUrl(`/notes/${id}`),{method:"DELETE",headers:authHeaders()}); loadAll(); }

  async function addStage(name) { await fetch(apiUrl("/pipeline-stages"),{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify({name, sequence:stages.length+1})}); loadAll(); }
  async function delStage(id) { if(!confirm("حذف المرحلة؟"))return; await fetch(apiUrl(`/pipeline-stages/${id}`),{method:"DELETE",headers:authHeaders()}); loadAll(); }
  async function updateStageAutomation(id, data) { await fetch(apiUrl(`/pipeline-stages/${id}`),{method:"PUT",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify(data)}); loadAll(); }

  async function addAutomationRule(payload) { await fetch(apiUrl("/automation-rules"),{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify(payload)}); loadAll(); }
  async function delAutomationRule(id) { if(!confirm("حذف القاعدة؟"))return; await fetch(apiUrl(`/automation-rules/${id}`),{method:"DELETE",headers:authHeaders()}); loadAll(); }

  function exportCsv(n,h,r) { exportTableCsv(n,h,r); }
  function exportPdf(t,s,su,h,r) { exportTablePdf(t,s,su,h,r); }
  function exportExcel(n,h,r) { exportTableXlsx(n,h,r); }

  if(!ready||!user) return <main className="loading-shell"><div className="loading-card">CRM Loading...</div></main>;

  return (<main className="erp-shell" dir="rtl"><Sidebar user={user}/><section className="erp-main">
    <div className="erp-hero"><div><div className="erp-hero-pill">CRM Workspace</div><h2>إدارة علاقات العملاء</h2></div></div>
    {msg && <div className="erp-form-message" style={{marginBottom:16}}>{msg}</div>}
    <nav style={{display:"flex",gap:6,borderBottom:"1px solid var(--rp-border)",marginBottom:16,flexWrap:"wrap"}}>
      {[{key:"contacts",label:"جهات الاتصال"},{key:"leads",label:"العملاء"},{key:"opportunities",label:"الفرص"},{key:"activities",label:"الأنشطة"},{key:"notes",label:"الملاحظات"},{key:"pipeline",label:"الأنابيب"},{key:"calendar",label:"التقويم"},{key:"dashboard",label:"لوحة التحكم"},{key:"pivot",label:"تحليل محوري"},{key:"stages",label:"المراحل"},{key:"forecast",label:"التنبؤ"},{key:"graph",label:"الرسوم"},{key:"leadAnalysis",label:"تحليل العملاء"},{key:"automation",label:"الأتمتة"}].map(t=>(<button key={t.key} className="erp-btn-ghost" style={{fontWeight:tab===t.key?900:400,borderBottom:tab===t.key?"2px solid var(--rp-primary)":"none",padding:"10px 16px",borderRadius:"12px 12px 0 0",background:tab===t.key?"var(--rp-surface)":"transparent"}} onClick={()=>setTab(t.key)}>{t.label}</button>))}
    </nav>

    {tab==="contacts" && (<><div className="erp-section-card" style={{marginBottom:18}}><h3>{editContactId?"تعديل جهة اتصال":"جهة اتصال جديدة"}</h3><form className="erp-form-grid erp-form-grid-2" onSubmit={saveContact} style={{gap:12}}>{["full_name","company_name","email","phone","mobile","address","city","country","job_title"].map(f=><input key={f} className="erp-input" placeholder={f==="full_name"?"الاسم الكامل":f==="company_name"?"الشركة":f==="email"?"البريد":f==="phone"?"الهاتف":f==="mobile"?"الجوال":f==="address"?"العنوان":f==="city"?"المدينة":f==="country"?"البلد":"المسمى الوظيفي"} value={contactForm[f]||""} onChange={e=>setContactForm({...contactForm,[f]:e.target.value})} required={f==="full_name"}/>)}{["notes"].map(f=><textarea key={f} className="erp-input" rows="2" placeholder="ملاحظات" value={contactForm[f]||""} onChange={e=>setContactForm({...contactForm,[f]:e.target.value})}/>)}<div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={busy}>{busy?"جار...":editContactId?"تحديث":"إضافة"}</button>{editContactId&&<button type="button" className="erp-btn-secondary" onClick={()=>{setEditContactId(null);setContactForm({full_name:"",company_name:"",email:"",phone:"",mobile:"",address:"",city:"",country:"",job_title:"",notes:""});}}>إلغاء</button>}</div></form></div><div className="erp-section-card"><div className="erp-section-head"><h3>جهات الاتصال</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportCsv("contacts.csv",["الاسم","الشركة","بريد","هاتف","جوال","مدينة","بلد","وظيفة","ملاحظات"],contacts.map(c=>[c.full_name||"",c.company_name||"",c.email||"",c.phone||"",c.mobile||"",c.city||"",c.country||"",c.job_title||"",c.notes||""]))}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportExcel("contacts.xlsx",["الاسم","الشركة","بريد","هاتف","جوال","مدينة","بلد","وظيفة","ملاحظات"],contacts.map(c=>[c.full_name||"",c.company_name||"",c.email||"",c.phone||"",c.mobile||"",c.city||"",c.country||"",c.job_title||"",c.notes||""]))}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={()=>exportPdf("جهات الاتصال","CRM",[{label:"عدد جهات الاتصال",value:contacts.length},{label:"بها بريد",value:contacts.filter(c=>c.email).length}],["الاسم","الشركة","بريد","هاتف","جوال","مدينة","بلد","وظيفة","ملاحظات"],contacts.map(c=>[c.full_name||"",c.company_name||"",c.email||"",c.phone||"",c.mobile||"",c.city||"",c.country||"",c.job_title||"",c.notes||""]))}>PDF</button></div></div><div className="erp-table-shell"><table className="erp-table"><thead><tr><th>الاسم</th><th>الشركة</th><th>بريد</th><th>هاتف</th><th>جوال</th><th>مدينة</th><th>بلد</th><th>وظيفة</th><th></th></tr></thead><tbody>{contacts.map(c=><tr key={c.id}><td>{c.full_name||"-"}</td><td>{c.company_name||"-"}</td><td>{c.email||"-"}</td><td>{c.phone||"-"}</td><td>{c.mobile||"-"}</td><td>{c.city||"-"}</td><td>{c.country||"-"}</td><td>{c.job_title||"-"}</td><td><div style={{display:"flex",gap:6}}><button className="erp-btn-secondary" style={{fontSize:12}} onClick={()=>editContact(c)}>تعديل</button><button className="erp-btn-danger" style={{fontSize:12}} onClick={()=>delContact(c.id)}>حذف</button></div></td></tr>)}</tbody></table></div></div></>)}

    {tab==="leads" && (<><div className="erp-section-card" style={{marginBottom:18}}><h3>{editLeadId?"تعديل عميل":"عميل جديد"}</h3><form className="erp-form-grid erp-form-grid-2" onSubmit={saveLead} style={{gap:12}}><select className="erp-input" value={leadForm.contact_id||""} onChange={e=>setLeadForm({...leadForm,contact_id:e.target.value})}><option value="">جهة اتصال (اختياري)</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select><input className="erp-input" placeholder="اسم جهة الاتصال" value={leadForm.contact_name||""} onChange={e=>setLeadForm({...leadForm,contact_name:e.target.value})} required/><input className="erp-input" placeholder="الشركة" value={leadForm.company_name||""} onChange={e=>setLeadForm({...leadForm,company_name:e.target.value})}/><input className="erp-input" placeholder="بريد" value={leadForm.email||""} onChange={e=>setLeadForm({...leadForm,email:e.target.value})}/><input className="erp-input" placeholder="هاتف" value={leadForm.phone||""} onChange={e=>setLeadForm({...leadForm,phone:e.target.value})}/><input className="erp-input" placeholder="جوال" value={leadForm.mobile||""} onChange={e=>setLeadForm({...leadForm,mobile:e.target.value})}/><input className="erp-input" placeholder="العنوان" value={leadForm.address||""} onChange={e=>setLeadForm({...leadForm,address:e.target.value})}/><input className="erp-input" placeholder="المدينة" value={leadForm.city||""} onChange={e=>setLeadForm({...leadForm,city:e.target.value})}/><input className="erp-input" placeholder="البلد" value={leadForm.country||""} onChange={e=>setLeadForm({...leadForm,country:e.target.value})}/><select className="erp-input" value={leadForm.priority||"medium"} onChange={e=>setLeadForm({...leadForm,priority:e.target.value})}><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالي</option></select><input className="erp-input" placeholder="المصدر" value={leadForm.source||""} onChange={e=>setLeadForm({...leadForm,source:e.target.value})}/><select className="erp-input" value={leadForm.factory_id||""} onChange={e=>setLeadForm({...leadForm,factory_id:e.target.value})}><option value="">اختر المصنع</option>{factories.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><textarea className="erp-input" rows="2" placeholder="ملاحظات" value={leadForm.notes||""} onChange={e=>setLeadForm({...leadForm,notes:e.target.value})}/><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={busy}>{busy?"جار...":editLeadId?"تحديث":"إنشاء"}</button>{editLeadId&&<button type="button" className="erp-btn-secondary" onClick={()=>setEditLeadId(null)}>إلغاء</button>}</div></form></div><div className="erp-section-card"><div className="erp-section-head"><h3>قائمة العملاء</h3><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className={view.leads==="kanban"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("leads","kanban")}>Kanban</button><button className={view.leads==="table"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("leads","table")}>جدول</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportCsv("leads.csv",["الاسم","الشركة","بريد","هاتف","جوال","مدينة","بلد","مصدر","أولوية","مصنع","حالة","ملاحظات"],leads.map(l=>[l.contact_name||"",l.company_name||"",l.email||"",l.phone||"",l.mobile||"",l.city||"",l.country||"",l.source||"",l.priority||"",factories.find(f=>f.id===l.factory_id)?.name||l.factory_id||"",l.status||"",l.notes||""]))}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportExcel("leads.xlsx",["الاسم","الشركة","بريد","هاتف","جوال","مدينة","بلد","مصدر","أولوية","مصنع","حالة","ملاحظات"],leads.map(l=>[l.contact_name||"",l.company_name||"",l.email||"",l.phone||"",l.mobile||"",l.city||"",l.country||"",l.source||"",l.priority||"",factories.find(f=>f.id===l.factory_id)?.name||l.factory_id||"",l.status||"",l.notes||""]))}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={()=>exportPdf("العملاء المحتملين","CRM",[{label:"عدد العملاء",value:leads.length},{label:"مؤهلين",value:leads.filter(l=>l.status==="qualified").length}],["الاسم","الشركة","بريد","هاتف","جوال","مدينة","بلد","مصدر","أولوية","مصنع","حالة","ملاحظات"],leads.map(l=>[l.contact_name||"",l.company_name||"",l.email||"",l.phone||"",l.mobile||"",l.city||"",l.country||"",l.source||"",l.priority||"",factories.find(f=>f.id===l.factory_id)?.name||l.factory_id||"",l.status||"",l.notes||""]))}>PDF</button></div></div>{view.leads==="kanban"?<KanbanBoard items={leads} statusField="status" statusOptions={LEAD_STATUSES} statusLabels={LEAD_STATUS_LABELS} statusColors={LEAD_STATUS_COLORS} renderCard={LeadCard} onAction={(lead)=>(<div style={{display:"flex",gap:4}}><button className="erp-btn-secondary" style={{fontSize:11}} onClick={()=>editLead(lead)}>تعديل</button><button className="erp-btn-primary" style={{fontSize:11}} onClick={()=>openConvertModal(lead)}>تحويل</button><button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>delLead(lead.id)}>حذف</button></div>)} emptyMessage="لا يوجد عملاء"/>:<div className="erp-table-shell"><table className="erp-table"><thead><tr><th>الاسم</th><th>الشركة</th><th>بريد</th><th>هاتف</th><th>جوال</th><th>مدينة</th><th>بلد</th><th>مصدر</th><th>أولوية</th><th>مصنع</th><th>حالة</th><th></th></tr></thead><tbody>{leads.map(l=><tr key={l.id}><td>{l.contact_name||"-"}</td><td>{l.company_name||"-"}</td><td>{l.email||"-"}</td><td>{l.phone||"-"}</td><td>{l.mobile||"-"}</td><td>{l.city||"-"}</td><td>{l.country||"-"}</td><td>{l.source||"-"}</td><td>{l.priority||"-"}</td><td>{factories.find(f=>f.id===l.factory_id)?.name||l.factory_id||"-"}</td><td>{l.status||"-"}</td><td><div style={{display:"flex",gap:6}}><button className="erp-btn-secondary" style={{fontSize:12}} onClick={()=>editLead(l)}>تعديل</button><button className="erp-btn-primary" style={{fontSize:12}} onClick={()=>openConvertModal(l)}>تحويل</button><button className="erp-btn-danger" style={{fontSize:12}} onClick={()=>delLead(l.id)}>حذف</button></div></td></tr>)}</tbody></table></div>}</div></>)}

    {tab==="opportunities" && (<div className="erp-section-card" style={{marginTop:18}}><div className="erp-section-head"><h3>الفرص البيعية</h3><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className={view.opps==="kanban"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("opps","kanban")}>Kanban</button><button className={view.opps==="table"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("opps","table")}>جدول</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportCsv("opps.csv",["الفرصة","الشركة","المرحلة","الإيراد","الاحتمال","الأولوية","ملاحظات"],opps.map(o=>[o.name||"",o.company_name||"",OPP_STAGE_LABELS[o.stage]||o.stage,fmt(o.expected_revenue),o.probability+"%",o.priority||"",o.notes||""]))}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportExcel("opps.xlsx",["الفرصة","الشركة","المرحلة","الإيراد","الاحتمال","الأولوية","ملاحظات"],opps.map(o=>[o.name||"",o.company_name||"",OPP_STAGE_LABELS[o.stage]||o.stage,fmt(o.expected_revenue),o.probability+"%",o.priority||"",o.notes||""]))}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={()=>exportPdf("الفرص البيعية","CRM",[{label:"عدد الفرص",value:opps.length},{label:"إجمالي الإيراد",value:fmt(opps.reduce((s,o)=>s+(o.expected_revenue||0),0))}],["الفرصة","الشركة","المرحلة","الإيراد","الاحتمال","الأولوية","ملاحظات"],opps.map(o=>[o.name||"",o.company_name||"",OPP_STAGE_LABELS[o.stage]||o.stage,fmt(o.expected_revenue),o.probability+"%",o.priority||"",o.notes||""]))}>PDF</button></div></div>{view.opps==="kanban"?<KanbanBoard items={opps} statusField="stage" statusOptions={OPP_STAGES} statusLabels={OPP_STAGE_LABELS} statusColors={OPP_STAGE_COLORS} stageTotals={stageTotals} stageMeta={stageMeta} renderCard={OppCard} onAction={(opp)=>(<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{OPP_STAGES.filter(s=>s!==opp.stage).slice(0,3).map(s=><button key={s} className="erp-btn-secondary" style={{fontSize:11}} onClick={()=>changeStage(opp.id,s)}>→ {OPP_STAGE_LABELS[s]}</button>)}<button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>delOpp(opp.id)}>حذف</button></div>)} onDragChange={(id,newStage)=>changeStage(id,newStage)} emptyMessage="لا توجد فرص"/>:<div className="erp-table-shell" style={{marginTop:12}}><table className="erp-table"><thead><tr><th>الفرصة</th><th>الشركة</th><th>المرحلة</th><th>الإيراد</th><th>الاحتمال</th><th>الأولوية</th><th></th></tr></thead><tbody>{opps.map(o=><tr key={o.id}><td>{o.name||"-"}</td><td>{o.company_name||"-"}</td><td><span className="erp-badge" style={{background:OPP_STAGE_COLORS[o.stage]+"22",color:OPP_STAGE_COLORS[o.stage]}}>{OPP_STAGE_LABELS[o.stage]}</span></td><td>{fmt(o.expected_revenue)}</td><td>{o.probability}%</td><td>{o.priority||"-"}</td><td><div style={{display:"flex",gap:6}}>{OPP_STAGES.filter(s=>s!==o.stage).map(s=><button key={s} className="erp-btn-secondary" style={{fontSize:11}} onClick={()=>changeStage(o.id,s)}>→ {OPP_STAGE_LABELS[s]}</button>)}<button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>delOpp(o.id)}>حذف</button></div></td></tr>)}</tbody></table></div>}</div>)}

    {tab==="activities" && (<><div className="erp-section-card" style={{marginBottom:18}}><h3>نشاط جديد</h3><form onSubmit={saveActivity} style={{display:"grid",gap:12}}><input className="erp-input" placeholder="الموضوع" value={actForm.subject} onChange={e=>setActForm({...actForm,subject:e.target.value})} required/><select className="erp-input" value={actForm.activity_type} onChange={e=>setActForm({...actForm,activity_type:e.target.value})}>{ACTIVITY_TYPES.map(t=><option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]||t}</option>)}</select><input className="erp-input" type="datetime-local" value={actForm.due_date} onChange={e=>setActForm({...actForm,due_date:e.target.value})}/><select className="erp-input" value={actForm.lead_id||""} onChange={e=>setActForm({...actForm,lead_id:e.target.value})}><option value="">اختر عميل</option>{leads.map(l=><option key={l.id} value={l.id}>{l.contact_name}</option>)}</select><select className="erp-input" value={actForm.opportunity_id||""} onChange={e=>setActForm({...actForm,opportunity_id:e.target.value})}><option value="">اختر فرصة</option>{opps.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><textarea className="erp-input" rows="2" placeholder="ملاحظات" value={actForm.notes||""} onChange={e=>setActForm({...actForm,notes:e.target.value})}/><button className="erp-btn-primary" type="submit" disabled={busy}>إضافة</button></form></div><div className="erp-section-card"><div className="erp-section-head"><h3>الأنشطة</h3><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className={view.activities==="kanban"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("activities","kanban")}>Kanban</button><button className={view.activities==="table"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("activities","table")}>جدول</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportCsv("acts.csv",["الموضوع","النوع","التاريخ","مكتمل","ملاحظات"],activities.map(a=>[a.subject||"",a.activity_type||"",a.due_date?.split("T")[0]||"",a.is_done?"نعم":"لا",a.notes||""]))}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportExcel("acts.xlsx",["الموضوع","النوع","التاريخ","مكتمل","ملاحظات"],activities.map(a=>[a.subject||"",a.activity_type||"",a.due_date?.split("T")[0]||"",a.is_done?"نعم":"لا",a.notes||""]))}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={()=>exportPdf("الأنشطة","CRM",[{label:"عدد الأنشطة",value:activities.length},{label:"مكتملة",value:activities.filter(a=>a.is_done).length}],["الموضوع","النوع","التاريخ","مكتمل","ملاحظات"],activities.map(a=>[a.subject||"",a.activity_type||"",a.due_date?.split("T")[0]||"",a.is_done?"نعم":"لا",a.notes||""]))}>PDF</button></div></div>{view.activities==="kanban"?<KanbanBoard items={activities} statusField="activity_type" statusOptions={ACTIVITY_TYPES} statusLabels={ACTIVITY_TYPE_LABELS} statusColors={ACTIVITY_TYPE_COLORS} renderCard={ActivityCard} onAction={(act)=>(<div style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={act.is_done} onChange={e=>toggleDone(act.id,e.target.checked)}/><button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>delActivity(act.id)}>حذف</button></div>)} emptyMessage="لا أنشطة"/>:<div className="erp-table-shell"><table className="erp-table"><thead><tr><th>الموضوع</th><th>النوع</th><th>التاريخ</th><th>مكتمل</th><th></th></tr></thead><tbody>{activities.map(a=><tr key={a.id}><td>{a.subject||"-"}</td><td>{a.activity_type||"-"}</td><td>{a.due_date?.split("T")[0]||"-"}</td><td><input type="checkbox" checked={a.is_done} onChange={e=>toggleDone(a.id,e.target.checked)}/></td><td><button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>delActivity(a.id)}>حذف</button></td></tr>)}</tbody></table></div>}</div></>)}

    {tab==="notes" && (<><div className="erp-section-card" style={{marginBottom:18}}><h3>ملاحظة جديدة</h3><form onSubmit={saveNote} style={{display:"grid",gap:12}}><select className="erp-input" value={noteForm.target_type} onChange={e=>setNoteForm({...noteForm,target_type:e.target.value})}><option value="lead">عميل</option><option value="opportunity">فرصة</option></select><select className="erp-input" value={noteForm.target_id} onChange={e=>setNoteForm({...noteForm,target_id:e.target.value})} required><option value="">اختر</option>{noteForm.target_type==="lead"?leads.map(l=><option key={l.id} value={l.id}>{l.contact_name}</option>):opps.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><input className="erp-input" placeholder="العنوان" value={noteForm.title} onChange={e=>setNoteForm({...noteForm,title:e.target.value})} required/><textarea className="erp-input" rows="3" placeholder="المحتوى" value={noteForm.content} onChange={e=>setNoteForm({...noteForm,content:e.target.value})} required/><select className="erp-input" value={noteForm.note_type} onChange={e=>setNoteForm({...noteForm,note_type:e.target.value})}>{NOTE_TYPES.map(t=><option key={t} value={t}>{NOTE_TYPE_LABELS[t]||t}</option>)}</select><button className="erp-btn-primary" type="submit" disabled={busy}>إضافة</button></form></div><div className="erp-section-card"><div className="erp-section-head"><h3>الملاحظات</h3><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className={view.notes==="kanban"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("notes","kanban")}>Kanban</button><button className={view.notes==="table"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("notes","table")}>جدول</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportCsv("notes.csv",["العنوان","النوع","المحتوى","المرتبط"],notes.map(n=>{const ref = n.lead_id ? `عميل #${n.lead_id}` : (n.opportunity_id ? `فرصة #${n.opportunity_id}` : "-"); return [n.title||"",n.note_type||"",n.content||"",ref]}))}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportExcel("notes.xlsx",["العنوان","النوع","المحتوى","المرتبط"],notes.map(n=>{const ref = n.lead_id ? `عميل #${n.lead_id}` : (n.opportunity_id ? `فرصة #${n.opportunity_id}` : "-"); return [n.title||"",n.note_type||"",n.content||"",ref]}))}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={()=>exportPdf("الملاحظات","CRM",[{label:"عدد الملاحظات",value:notes.length}],["العنوان","النوع","المحتوى","المرتبط"],notes.map(n=>{const ref = n.lead_id ? `عميل #${n.lead_id}` : (n.opportunity_id ? `فرصة #${n.opportunity_id}` : "-"); return [n.title||"",n.note_type||"",n.content||"",ref]}))}>PDF</button></div></div>{view.notes==="kanban"?<KanbanBoard items={notes} statusField="note_type" statusOptions={NOTE_TYPES} statusLabels={NOTE_TYPE_LABELS} statusColors={NOTE_TYPE_COLORS} renderCard={NoteCard} onAction={(note)=><button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>delNote(note.id)}>حذف</button>} emptyMessage="لا ملاحظات"/>:<div className="erp-table-shell"><table className="erp-table"><thead><tr><th>العنوان</th><th>النوع</th><th>المحتوى</th><th>المرتبط</th><th></th></tr></thead><tbody>{notes.map(n=><tr key={n.id}><td>{n.title||"-"}</td><td>{n.note_type||"-"}</td><td>{n.content||"-"}</td><td>{n.lead_id?`عميل #${n.lead_id}`:(n.opportunity_id?`فرصة #${n.opportunity_id}`:"-")}</td><td><button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>delNote(n.id)}>حذف</button></td></tr>)}</tbody></table></div>}</div></>)}

    {tab==="pipeline" && (<div className="erp-section-card" style={{marginTop:18}}><div className="erp-section-head"><h3>خط الأنابيب</h3><div style={{display:"flex",gap:8}}><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportCsv("pipeline.csv",["المرحلة","عدد الفرص","القيمة"],pipeline.map(s=>[OPP_STAGE_LABELS[s.stage]||s.stage,s.count,fmt(s.total_value)]))}>CSV</button><button className="erp-btn-secondary" style={btnStyle} onClick={()=>exportExcel("pipeline.xlsx",["المرحلة","عدد الفرص","القيمة"],pipeline.map(s=>[OPP_STAGE_LABELS[s.stage]||s.stage,s.count,fmt(s.total_value)]))}>Excel</button><button className="erp-btn-primary" style={btnStyle} onClick={()=>exportPdf("خط الأنابيب","CRM",[{label:"إجمالي المراحل",value:pipeline.length},{label:"إجمالي القيمة",value:fmt(pipeline.reduce((s,i)=>s+i.total_value,0))}],["المرحلة","عدد الفرص","القيمة"],pipeline.map(s=>[OPP_STAGE_LABELS[s.stage]||s.stage,s.count,fmt(s.total_value)]))}>PDF</button></div></div>{pipeline.length===0?<div className="erp-form-message">لا توجد فرص.</div>:<div className="erp-table-shell"><table className="erp-table"><thead><tr><th>المرحلة</th><th>عدد الفرص</th><th>القيمة</th></tr></thead><tbody>{pipeline.map(s=><tr key={s.stage}><td><span className="erp-badge" style={{background:OPP_STAGE_COLORS[s.stage] + "22", color: OPP_STAGE_COLORS[s.stage]}}>{OPP_STAGE_LABELS[s.stage]||s.stage}</span></td><td>{s.count}</td><td>{fmt(s.total_value)}</td></tr>)}</tbody></table></div>}</div>)}

    {tab==="calendar" && <CalendarView activities={activities} opps={opps} onExportCsv={()=>exportCsv("calendar.csv",["التاريخ","النوع","الموضوع"],activities.map(a=>[a.due_date?.split("T")[0]||"",a.activity_type,a.subject]))} onExportPdf={()=>exportPdf("التقويم","CRM",[{label:"أنشطة",value:activities.length},{label:"فرص",value:opps.length}],["التاريخ","النوع","الموضوع"],activities.map(a=>[a.due_date?.split("T")[0]||"",a.activity_type,a.subject]))} onExportExcel={()=>exportExcel("calendar.xlsx",["التاريخ","النوع","الموضوع"],activities.map(a=>[a.due_date?.split("T")[0]||"",a.activity_type,a.subject]))} />}
    {tab==="dashboard" && <DashboardView leads={leads} opps={opps} activities={activities} pipeline={pipeline} onExportCsv={()=>exportCsv("dashboard.csv",["البند","القيمة"],[["عملاء",leads.length],["فرص",opps.length],["قيمة الخط",pipeline.reduce((s,i)=>s+i.total_value,0)],["أنشطة مفتوحة",activities.filter(a=>!a.is_done).length],["تحويل %",leads.length>0?Math.round((opps.filter(o=>o.stage==='closed_won').length/leads.length)*100):0]])} onExportPdf={()=>exportPdf("لوحة التحكم","CRM",[{label:"عملاء",value:leads.length},{label:"فرص",value:opps.length},{label:"قيمة الخط",value:fmt(pipeline.reduce((s,i)=>s+i.total_value,0))}],["البند","القيمة"],[["عملاء",leads.length],["فرص",opps.length],["قيمة الخط",pipeline.reduce((s,i)=>s+i.total_value,0)],["أنشطة مفتوحة",activities.filter(a=>!a.is_done).length],["تحويل %",leads.length>0?Math.round((opps.filter(o=>o.stage==='closed_won').length/leads.length)*100):0]])} onExportExcel={()=>exportExcel("dashboard.xlsx",["البند","القيمة"],[["عملاء",leads.length],["فرص",opps.length],["قيمة الخط",pipeline.reduce((s,i)=>s+i.total_value,0)],["أنشطة مفتوحة",activities.filter(a=>!a.is_done).length],["تحويل %",leads.length>0?Math.round((opps.filter(o=>o.stage==='closed_won').length/leads.length)*100):0]])} />}
    {tab==="pivot" && <PivotView opps={opps} onExportCsv={()=>exportCsv("pivot.csv",["المرحلة","الشهر","عدد","القيمة"],opps.map(o=>{const rv = o.stage||"unknown"; const cv = o.created_at?o.created_at.substring(0,7):"unknown"; return [rv,cv,1,o.expected_revenue||0]}))} onExportPdf={()=>exportPdf("تحليل محوري","CRM",[{label:"عدد الفرص",value:opps.length}],["المرحلة","الشهر","عدد","القيمة"],opps.map(o=>{const rv = o.stage||"unknown"; const cv = o.created_at?o.created_at.substring(0,7):"unknown"; return [rv,cv,1,o.expected_revenue||0]}))} onExportExcel={()=>exportExcel("pivot.xlsx",["المرحلة","الشهر","عدد","القيمة"],opps.map(o=>{const rv = o.stage||"unknown"; const cv = o.created_at?o.created_at.substring(0,7):"unknown"; return [rv,cv,1,o.expected_revenue||0]}))} />}
    {tab==="stages" && <StageManager stages={stages} onSave={addStage} onDelete={delStage} onUpdateAutomation={updateStageAutomation} onExportCsv={()=>exportCsv("stages.csv",["الاسم","الترتيب","Is Won","Days to Rot","متطلبات","أتمتة"],stages.map(s=>[s.name,s.sequence,s.is_won?"نعم":"لا",s.days_to_rot||"",s.requirements||"",s.automation_action?`${s.automation_trigger} -> ${s.automation_action}`:"لا يوجد"]))} onExportPdf={()=>exportPdf("المراحل","CRM",[{label:"عدد المراحل",value:stages.length}],["الاسم","الترتيب","Is Won","Days to Rot","متطلبات","أتمتة"],stages.map(s=>[s.name,s.sequence,s.is_won?"نعم":"لا",s.days_to_rot||"",s.requirements||"",s.automation_action?`${s.automation_trigger} -> ${s.automation_action}`:"لا يوجد"]))} onExportExcel={()=>exportExcel("stages.xlsx",["الاسم","الترتيب","Is Won","Days to Rot","متطلبات","أتمتة"],stages.map(s=>[s.name,s.sequence,s.is_won?"نعم":"لا",s.days_to_rot||"",s.requirements||"",s.automation_action?`${s.automation_trigger} -> ${s.automation_action}`:"لا يوجد"]))} />}
    {tab==="forecast" && <ForecastView forecast={forecast} onExportCsv={()=>exportCsv("forecast.csv",["الشهر","القيمة المتوقعة"],forecast.map(d=>[d.month,fmt(d.forecast_value)]))} onExportPdf={()=>exportPdf("التنبؤ","CRM",[{label:"عدد الأشهر",value:forecast.length}],["الشهر","القيمة المتوقعة"],forecast.map(d=>[d.month,fmt(d.forecast_value)]))} onExportExcel={()=>exportExcel("forecast.xlsx",["الشهر","القيمة المتوقعة"],forecast.map(d=>[d.month,fmt(d.forecast_value)]))} />}
    {tab==="graph" && <GraphView graphData={graphData} onExportCsv={()=>exportCsv("graph.csv",["المرحلة","عدد الفرص"],graphData.map(d=>[d.label,d.value]))} onExportPdf={()=>exportPdf("الرسوم","CRM",[{label:"عدد المراحل",value:graphData.length}],["المرحلة","عدد الفرص"],graphData.map(d=>[d.label,d.value]))} onExportExcel={()=>exportExcel("graph.xlsx",["المرحلة","عدد الفرص"],graphData.map(d=>[d.label,d.value]))} />}
    {tab==="leadAnalysis" && <LeadAnalysisView leadAnalysis={leadAnalysis} onExportCsv={()=>exportCsv("lead_analysis.csv",["النوع","البند","العدد"],[...leadAnalysis.sources.map(s=>["مصدر",s.source,s.count]),...leadAnalysis.statuses.map(s=>["حالة",LEAD_STATUS_LABELS[s.status]||s.status,s.count])])} onExportPdf={()=>exportPdf("تحليل العملاء","CRM",[{label:"عدد المصادر",value:leadAnalysis.sources.length},{label:"عدد الحالات",value:leadAnalysis.statuses.length}],["النوع","البند","العدد"],[...leadAnalysis.sources.map(s=>["مصدر",s.source,s.count]),...leadAnalysis.statuses.map(s=>["حالة",LEAD_STATUS_LABELS[s.status]||s.status,s.count])])} onExportExcel={()=>exportExcel("lead_analysis.xlsx",["النوع","البند","العدد"],[...leadAnalysis.sources.map(s=>["مصدر",s.source,s.count]),...leadAnalysis.statuses.map(s=>["حالة",LEAD_STATUS_LABELS[s.status]||s.status,s.count])])} />}
    {tab==="automation" && <AutomationRulesView rules={automationRules} onAdd={addAutomationRule} onDelete={delAutomationRule} onExportCsv={()=>exportCsv("automation_rules.csv",["الاسم","المحفز","الإجراء"],automationRules.map(r=>[r.name,`${r.trigger_field}=${r.trigger_value}`,r.action_type]))} onExportPdf={()=>exportPdf("قواعد الأتمتة","CRM",[{label:"عدد القواعد",value:automationRules.length}],["الاسم","المحفز","الإجراء"],automationRules.map(r=>[r.name,`${r.trigger_field}=${r.trigger_value}`,r.action_type]))} onExportExcel={()=>exportExcel("automation_rules.xlsx",["الاسم","المحفز","الإجراء"],automationRules.map(r=>[r.name,`${r.trigger_field}=${r.trigger_value}`,r.action_type]))} />}

    {convertModal.open && (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
        <div style={{background:'white',borderRadius:24,padding:24,width:480,maxWidth:'90%'}}>
          <h3>تحويل العميل إلى فرصة</h3>
          <form onSubmit={handleConvertSubmit} style={{display:'grid',gap:12}}>
            <input className="erp-input" placeholder="اسم الفرصة" value={convertModal.name} onChange={e=>setConvertModal({...convertModal,name:e.target.value})} required/>
            <input className="erp-input" type="number" placeholder="الإيراد المتوقع" value={convertModal.expected_revenue} onChange={e=>setConvertModal({...convertModal,expected_revenue:e.target.value})}/>
            <select className="erp-input" value={convertModal.stage} onChange={e=>setConvertModal({...convertModal,stage:e.target.value})}>
              {OPP_STAGES.map(s=><option key={s} value={s}>{OPP_STAGE_LABELS[s]}</option>)}
            </select>
            <div style={{display:'flex',gap:8}}>
              <button className="erp-btn-primary" type="submit" disabled={busy}>تحويل</button>
              <button className="erp-btn-secondary" type="button" onClick={()=>setConvertModal({open:false,leadId:null,name:"",expected_revenue:"",stage:"qualification"})}>إلغاء</button>
            </div>
          </form>
        </div>
      </div>
    )}
  </section></main>);
}
