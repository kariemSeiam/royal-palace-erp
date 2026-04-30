from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date

from src.api.deps.admin_auth import (
    get_current_user_and_role, get_user_factory_scope_id,
    is_factory_scoped, has_any_permission, ensure_not_blocked_admin_role,
)
from src.core.db.session import get_db
from src.models.crm import CrmContact, CrmLead, CrmOpportunity, CrmTeam, CrmActivity, CrmNote, CrmPipelineStage, CrmAutomationRule
from src.models.user import User

router = APIRouter(prefix="/admin/crm", tags=["admin-crm"])

async def require_crm_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "crm.view", "crm.manage"):
        raise HTTPException(status_code=403, detail="CRM access denied")
    return user

def serialize_contact(row): return {"id":row.id, "full_name":row.full_name, "company_name":row.company_name, "email":row.email, "phone":row.phone, "mobile":row.mobile, "address":row.address, "city":row.city, "country":row.country, "job_title":row.job_title, "notes":row.notes}
def serialize_team(row): return {"id":row.id, "name":row.name, "code":row.code}
def serialize_lead(row): return {"id":row.id, "contact_id":row.contact_id, "team_id":row.team_id, "factory_id":row.factory_id, "assigned_to_user_id":row.assigned_to_user_id, "contact_name":row.contact_name, "company_name":row.company_name, "email":row.email, "phone":row.phone, "mobile":row.mobile, "address":row.address, "city":row.city, "country":row.country, "source":row.source, "priority":row.priority, "status":row.status, "notes":row.notes}
def serialize_opportunity(row): return {"id":row.id, "lead_id":row.lead_id, "contact_id":row.contact_id, "team_id":row.team_id, "factory_id":row.factory_id, "assigned_to_user_id":row.assigned_to_user_id, "name":row.name, "contact_name":row.contact_name, "company_name":row.company_name, "expected_revenue":float(row.expected_revenue or 0), "probability":row.probability, "stage":row.stage, "priority":row.priority, "notes":row.notes, "is_active":row.is_active}
def serialize_activity(row): return {"id":row.id, "lead_id":row.lead_id, "opportunity_id":row.opportunity_id, "team_id":row.team_id, "assigned_to_user_id":row.assigned_to_user_id, "activity_type":row.activity_type, "subject":row.subject, "due_date":row.due_date.isoformat() if row.due_date else None, "is_done":row.is_done, "notes":row.notes}
def serialize_note(row): return {"id":row.id, "lead_id":row.lead_id, "opportunity_id":row.opportunity_id, "note_type":row.note_type, "title":row.title, "content":row.content}

@router.get("/contacts")
async def list_contacts(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CrmContact).order_by(CrmContact.id.asc()).limit(200))
    return [serialize_contact(r) for r in result.scalars().all()]

@router.post("/contacts", status_code=201)
async def create_contact(payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    fields = ["full_name","company_name","email","phone","mobile","address","city","country","job_title","notes"]
    contact = CrmContact(**{k:v for k,v in payload.items() if k in fields})
    db.add(contact); await db.commit(); await db.refresh(contact)
    return serialize_contact(contact)

@router.put("/contacts/{contact_id}")
async def update_contact(contact_id: int, payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    contact = (await db.execute(select(CrmContact).where(CrmContact.id == contact_id))).scalar_one_or_none()
    if not contact: raise HTTPException(404, "Contact not found")
    for f in ["full_name","company_name","email","phone","mobile","address","city","country","job_title","notes"]:
        if f in payload: setattr(contact, f, payload[f])
    await db.commit(); await db.refresh(contact)
    return serialize_contact(contact)

@router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: int, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    contact = (await db.execute(select(CrmContact).where(CrmContact.id == contact_id))).scalar_one_or_none()
    if not contact: raise HTTPException(404, "Contact not found")
    await db.delete(contact); await db.commit()
    return {"message": "Contact deleted"}

@router.get("/teams")
async def list_teams(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CrmTeam).order_by(CrmTeam.id.asc()))
    return [serialize_team(r) for r in result.scalars().all()]

@router.get("/leads")
async def list_leads(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stmt = select(CrmLead).order_by(CrmLead.id.desc()).limit(200)
    if is_factory_scoped(current_user):
        scoped = get_user_factory_scope_id(current_user)
        if scoped: stmt = stmt.where(CrmLead.factory_id == scoped)
    result = await db.execute(stmt)
    return [serialize_lead(r) for r in result.scalars().all()]

@router.post("/leads", status_code=201)
async def create_lead(payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    fields = ["contact_id","team_id","factory_id","assigned_to_user_id","contact_name","company_name","email","phone","mobile","address","city","country","source","priority","notes"]
    lead = CrmLead(**{k:v for k,v in payload.items() if k in fields})
    db.add(lead); await db.commit(); await db.refresh(lead)
    return serialize_lead(lead)

@router.put("/leads/{lead_id}")
async def update_lead(lead_id: int, payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    lead = (await db.execute(select(CrmLead).where(CrmLead.id == lead_id))).scalar_one_or_none()
    if not lead: raise HTTPException(404, "Lead not found")
    for f in ["contact_id","team_id","factory_id","assigned_to_user_id","contact_name","company_name","email","phone","mobile","address","city","country","source","priority","status","notes"]:
        if f in payload: setattr(lead, f, payload[f])
    await db.commit(); await db.refresh(lead)
    return serialize_lead(lead)

@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: int, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    lead = (await db.execute(select(CrmLead).where(CrmLead.id == lead_id))).scalar_one_or_none()
    if not lead: raise HTTPException(404, "Lead not found")
    await db.delete(lead); await db.commit()
    return {"message": "Lead deleted"}

@router.post("/leads/{lead_id}/convert", status_code=201)
async def convert_lead(lead_id: int, payload: dict = None, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    lead = (await db.execute(select(CrmLead).where(CrmLead.id == lead_id))).scalar_one_or_none()
    if not lead: raise HTTPException(404, "Lead not found")
    opp = CrmOpportunity(
        lead_id=lead.id,
        contact_id=lead.contact_id,
        team_id=lead.team_id,
        factory_id=lead.factory_id,
        assigned_to_user_id=lead.assigned_to_user_id,
        name=payload.get("name") if payload and payload.get("name") else f"{lead.company_name or lead.contact_name} - Opportunity",
        contact_name=lead.contact_name,
        company_name=lead.company_name,
        stage=payload.get("stage") if payload and payload.get("stage") else "qualification",
        expected_revenue=payload.get("expected_revenue") if payload else None,
        notes=lead.notes
    )
    lead.status = "converted"
    db.add(opp); await db.commit(); await db.refresh(opp)
    return serialize_opportunity(opp)

@router.get("/opportunities")
async def list_opportunities(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stmt = select(CrmOpportunity).order_by(CrmOpportunity.id.desc()).limit(200)
    if is_factory_scoped(current_user):
        scoped = get_user_factory_scope_id(current_user)
        if scoped: stmt = stmt.where(CrmOpportunity.factory_id == scoped)
    result = await db.execute(stmt)
    return [serialize_opportunity(r) for r in result.scalars().all()]

@router.put("/opportunities/{opportunity_id}")
async def update_opportunity(opportunity_id: int, payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    opp = (await db.execute(select(CrmOpportunity).where(CrmOpportunity.id == opportunity_id))).scalar_one_or_none()
    if not opp: raise HTTPException(404, "Opportunity not found")
    for f in ["contact_id","team_id","factory_id","assigned_to_user_id","name","contact_name","company_name","expected_revenue","probability","stage","priority","expected_closing_date","notes"]:
        if f in payload: setattr(opp, f, payload[f])
    await db.commit(); await db.refresh(opp)
    return serialize_opportunity(opp)

@router.patch("/opportunities/{opportunity_id}/stage")
async def update_stage(opportunity_id: int, payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    opp = (await db.execute(select(CrmOpportunity).where(CrmOpportunity.id == opportunity_id))).scalar_one_or_none()
    if not opp: raise HTTPException(404, "Opportunity not found")
    opp.stage = payload.get("stage")
    await db.commit(); await db.refresh(opp)
    return serialize_opportunity(opp)

@router.delete("/opportunities/{opportunity_id}")
async def delete_opportunity(opportunity_id: int, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    opp = (await db.execute(select(CrmOpportunity).where(CrmOpportunity.id == opportunity_id))).scalar_one_or_none()
    if not opp: raise HTTPException(404, "Opportunity not found")
    await db.delete(opp); await db.commit()
    return {"message": "Opportunity deleted"}

@router.get("/activities")
async def list_activities(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stmt = select(CrmActivity).order_by(CrmActivity.due_date.asc().nullslast(), CrmActivity.id.desc()).limit(200)
    result = await db.execute(stmt)
    return [serialize_activity(r) for r in result.scalars().all()]

@router.post("/activities", status_code=201)
async def create_activity(payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    due_date = None
    if due_str := payload.get("due_date"):
        try: due_date = datetime.fromisoformat(due_str)
        except ValueError: pass
    activity = CrmActivity(lead_id=payload.get("lead_id"), opportunity_id=payload.get("opportunity_id"), team_id=payload.get("team_id"), assigned_to_user_id=payload.get("assigned_to_user_id") or current_user.id, activity_type=payload.get("activity_type","task"), subject=payload["subject"], description=payload.get("description"), due_date=due_date, notes=payload.get("notes"))
    db.add(activity); await db.commit(); await db.refresh(activity)
    return serialize_activity(activity)

@router.put("/activities/{activity_id}")
async def update_activity(activity_id: int, payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    activity = (await db.execute(select(CrmActivity).where(CrmActivity.id == activity_id))).scalar_one_or_none()
    if not activity: raise HTTPException(404, "Activity not found")
    for f in ["subject","activity_type","due_date","is_done","notes","assigned_to_user_id"]:
        if f in payload:
            val = payload[f]
            if f == "due_date" and isinstance(val, str):
                try: val = datetime.fromisoformat(val)
                except: continue
            setattr(activity, f, val)
    if payload.get("is_done") and not activity.done_at: activity.done_at = datetime.utcnow()
    await db.commit(); await db.refresh(activity)
    return serialize_activity(activity)

@router.delete("/activities/{activity_id}")
async def delete_activity(activity_id: int, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    activity = (await db.execute(select(CrmActivity).where(CrmActivity.id == activity_id))).scalar_one_or_none()
    if not activity: raise HTTPException(404, "Activity not found")
    await db.delete(activity); await db.commit()
    return {"message": "Activity deleted"}

@router.get("/notes")
async def list_notes(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stmt = select(CrmNote).order_by(CrmNote.created_at.desc()).limit(200)
    result = await db.execute(stmt)
    return [serialize_note(r) for r in result.scalars().all()]

@router.post("/notes", status_code=201)
async def create_note(payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    lead_id = payload.get("lead_id"); opp_id = payload.get("opportunity_id")
    if not lead_id and not opp_id: raise HTTPException(400, "Must provide lead_id or opportunity_id")
    note = CrmNote(lead_id=lead_id, opportunity_id=opp_id, note_type=payload.get("note_type","comment"), title=payload["title"], content=payload["content"], created_by_user_id=current_user.id)
    db.add(note); await db.commit(); await db.refresh(note)
    return serialize_note(note)

@router.delete("/notes/{note_id}")
async def delete_note(note_id: int, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    note = (await db.execute(select(CrmNote).where(CrmNote.id == note_id))).scalar_one_or_none()
    if not note: raise HTTPException(404, "Note not found")
    await db.delete(note); await db.commit()
    return {"message": "Note deleted"}

@router.get("/pipeline-stages")
async def list_pipeline_stages(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CrmPipelineStage).order_by(CrmPipelineStage.sequence))
    return [{"id":r.id, "name":r.name, "sequence":r.sequence, "is_active":r.is_active, "requirements":r.requirements, "automation_action":r.automation_action, "automation_trigger":r.automation_trigger} for r in result.scalars().all()]

@router.post("/pipeline-stages", status_code=201)
async def create_pipeline_stage(payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stage = CrmPipelineStage(name=payload["name"], sequence=payload.get("sequence",0), requirements=payload.get("requirements"), automation_action=payload.get("automation_action"), automation_trigger=payload.get("automation_trigger"), team_id=payload.get("team_id"))
    db.add(stage); await db.commit(); await db.refresh(stage)
    return {"id":stage.id, "name":stage.name, "sequence":stage.sequence}

@router.put("/pipeline-stages/{stage_id}")
async def update_pipeline_stage(stage_id: int, payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stage = (await db.execute(select(CrmPipelineStage).where(CrmPipelineStage.id == stage_id))).scalar_one_or_none()
    if not stage: raise HTTPException(404, "Stage not found")
    for f in ["name","sequence","is_active","requirements","automation_action","automation_trigger"]:
        if f in payload: setattr(stage, f, payload[f])
    await db.commit(); await db.refresh(stage)
    return {"id":stage.id, "name":stage.name, "sequence":stage.sequence, "requirements":stage.requirements, "automation_action":stage.automation_action, "automation_trigger":stage.automation_trigger}

@router.delete("/pipeline-stages/{stage_id}")
async def delete_pipeline_stage(stage_id: int, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stage = (await db.execute(select(CrmPipelineStage).where(CrmPipelineStage.id == stage_id))).scalar_one_or_none()
    if not stage: raise HTTPException(404, "Stage not found")
    await db.delete(stage); await db.commit()
    return {"message": "Stage deleted"}

@router.get("/pipeline-report")
async def pipeline_report(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stmt = select(CrmOpportunity.stage, func.count(CrmOpportunity.id).label("count"), func.coalesce(func.sum(CrmOpportunity.expected_revenue),0).label("total_value"))
    if is_factory_scoped(current_user): stmt = stmt.where(CrmOpportunity.factory_id == get_user_factory_scope_id(current_user))
    stmt = stmt.where(CrmOpportunity.is_active == True).group_by(CrmOpportunity.stage).order_by(CrmOpportunity.stage)
    rows = (await db.execute(stmt)).all()
    return [{"stage":r.stage, "count":r.count, "total_value":float(r.total_value)} for r in rows]

@router.get("/forecast")
async def get_forecast(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db), months: int = Query(6)):
    today = datetime.utcnow().date()
    months_data = []
    for i in range(months):
        month_start = date(today.year + (today.month + i - 1) // 12, (today.month + i - 1) % 12 + 1, 1)
        next_month_start = date(month_start.year + (month_start.month // 12), (month_start.month % 12) + 1, 1)
        stmt = (
            select(func.coalesce(func.sum(CrmOpportunity.expected_revenue * CrmOpportunity.probability / 100.0), 0))
            .where(CrmOpportunity.is_active == True, CrmOpportunity.expected_closing_date >= month_start, CrmOpportunity.expected_closing_date < next_month_start)
        )
        if is_factory_scoped(current_user):
            stmt = stmt.where(CrmOpportunity.factory_id == get_user_factory_scope_id(current_user))
        value = (await db.execute(stmt)).scalar() or 0
        months_data.append({"month": month_start.strftime("%Y-%m"), "forecast_value": float(value)})
    return months_data

@router.get("/graph-data")
async def graph_data(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stmt = select(CrmOpportunity.stage, func.count(CrmOpportunity.id).label("count"))
    if is_factory_scoped(current_user): stmt = stmt.where(CrmOpportunity.factory_id == get_user_factory_scope_id(current_user))
    stmt = stmt.where(CrmOpportunity.is_active == True).group_by(CrmOpportunity.stage).order_by(CrmOpportunity.stage)
    rows = (await db.execute(stmt)).all()
    return [{"label": r.stage, "value": r.count} for r in rows]

@router.get("/lead-analysis")
async def lead_analysis(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    stmt1 = select(CrmLead.source, func.count(CrmLead.id).label("count")).where(CrmLead.source.isnot(None)).group_by(CrmLead.source).order_by(func.count(CrmLead.id).desc())
    if is_factory_scoped(current_user): stmt1 = stmt1.where(CrmLead.factory_id == get_user_factory_scope_id(current_user))
    rows1 = (await db.execute(stmt1)).all()
    sources = [{"source": r.source, "count": r.count} for r in rows1]

    stmt2 = select(CrmLead.status, func.count(CrmLead.id).label("count")).group_by(CrmLead.status).order_by(func.count(CrmLead.id).desc())
    if is_factory_scoped(current_user): stmt2 = stmt2.where(CrmLead.factory_id == get_user_factory_scope_id(current_user))
    rows2 = (await db.execute(stmt2)).all()
    statuses = [{"status": r.status, "count": r.count} for r in rows2]

    return {"sources": sources, "statuses": statuses}

@router.get("/automation-rules")
async def list_automation_rules(current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CrmAutomationRule).order_by(CrmAutomationRule.id.asc()))
    return [{"id":r.id, "name":r.name, "model":r.model, "trigger_field":r.trigger_field, "trigger_value":r.trigger_value, "action_type":r.action_type, "action_config":r.action_config, "is_active":r.is_active} for r in result.scalars().all()]

@router.post("/automation-rules", status_code=201)
async def create_automation_rule(payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    rule = CrmAutomationRule(
        name=payload["name"],
        model=payload.get("model", "crm.lead"),
        trigger_field=payload["trigger_field"],
        trigger_value=payload["trigger_value"],
        action_type=payload["action_type"],
        action_config=payload.get("action_config", {})
    )
    db.add(rule); await db.commit(); await db.refresh(rule)
    return {"id":rule.id, "name":rule.name, "trigger_field":rule.trigger_field}

@router.put("/automation-rules/{rule_id}")
async def update_automation_rule(rule_id: int, payload: dict, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    rule = (await db.execute(select(CrmAutomationRule).where(CrmAutomationRule.id == rule_id))).scalar_one_or_none()
    if not rule: raise HTTPException(404, "Rule not found")
    for f in ["name","model","trigger_field","trigger_value","action_type","action_config","is_active"]:
        if f in payload: setattr(rule, f, payload[f])
    await db.commit(); await db.refresh(rule)
    return {"id":rule.id, "name":rule.name}

@router.delete("/automation-rules/{rule_id}")
async def delete_automation_rule(rule_id: int, current_user=Depends(require_crm_view), db: AsyncSession = Depends(get_db)):
    rule = (await db.execute(select(CrmAutomationRule).where(CrmAutomationRule.id == rule_id))).scalar_one_or_none()
    if not rule: raise HTTPException(404, "Rule not found")
    await db.delete(rule); await db.commit()
    return {"message": "Rule deleted"}
