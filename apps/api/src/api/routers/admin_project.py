from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.project import ProjectProject, ProjectTask
from src.models.user import User

router = APIRouter(prefix="/admin/project", tags=["admin-project"])

async def require_project_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser:
        return user
    if not has_any_permission(permissions, "project.view", "project.manage"):
        raise HTTPException(status_code=403, detail="Project access denied")
    return user

@router.get("/projects")
async def list_projects(current_user: User = Depends(require_project_view), db: AsyncSession = Depends(get_db)):
    stmt = select(ProjectProject).order_by(ProjectProject.id.desc())
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(ProjectProject.factory_id == scoped_id)
    result = await db.execute(stmt.limit(200))
    rows = result.scalars().all()
    return [{"id": r.id, "name": r.name, "code": r.code, "factory_id": r.factory_id, "manager_user_id": r.manager_user_id, "start_date": str(r.start_date) if r.start_date else None, "end_date": str(r.end_date) if r.end_date else None, "status": r.status, "description": r.description, "is_active": r.is_active} for r in rows]

@router.post("/projects", status_code=201)
async def create_project(payload: dict, current_user: User = Depends(require_project_view), db: AsyncSession = Depends(get_db)):
    project = ProjectProject(name=payload["name"], code=payload["code"], factory_id=payload.get("factory_id"), manager_user_id=payload.get("manager_user_id"), start_date=payload.get("start_date"), end_date=payload.get("end_date"), description=payload.get("description"), status=payload.get("status", "planning"))
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return serialize_project(project)

@router.put("/projects/{project_id}")
async def update_project(project_id: int, payload: dict, current_user: User = Depends(require_project_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProjectProject).where(ProjectProject.id == project_id))
    project = result.scalar_one_or_none()
    if not project: raise HTTPException(status_code=404, detail="Not found")
    for f in ["name","code","factory_id","manager_user_id","start_date","end_date","description","status"]:
        if f in payload: setattr(project, f, payload[f])
    await db.commit()
    await db.refresh(project)
    return serialize_project(project)

@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, current_user: User = Depends(require_project_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProjectProject).where(ProjectProject.id == project_id))
    project = result.scalar_one_or_none()
    if not project: raise HTTPException(status_code=404, detail="Not found")
    await db.delete(project)
    await db.commit()
    return {"message": "Project deleted"}

@router.get("/tasks")
async def list_tasks(current_user: User = Depends(require_project_view), db: AsyncSession = Depends(get_db)):
    stmt = select(ProjectTask).order_by(ProjectTask.id.desc())
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(ProjectTask.factory_id == scoped_id)
    result = await db.execute(stmt.limit(500))
    rows = result.scalars().all()
    return [serialize_task(r) for r in rows]

@router.post("/tasks", status_code=201)
async def create_task(payload: dict, current_user: User = Depends(require_project_view), db: AsyncSession = Depends(get_db)):
    task = ProjectTask(project_id=payload["project_id"], name=payload["name"], assigned_to_user_id=payload.get("assigned_to_user_id"), factory_id=payload.get("factory_id"), planned_start_date=payload.get("planned_start_date"), planned_end_date=payload.get("planned_end_date"), priority=payload.get("priority","normal"), stage=payload.get("stage","todo"), notes=payload.get("notes"))
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return serialize_task(task)

@router.put("/tasks/{task_id}")
async def update_task(task_id: int, payload: dict, current_user: User = Depends(require_project_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProjectTask).where(ProjectTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task: raise HTTPException(status_code=404, detail="Not found")
    for f in ["name","assigned_to_user_id","factory_id","planned_start_date","planned_end_date","actual_start_date","actual_end_date","progress_percent","priority","stage","notes"]:
        if f in payload: setattr(task, f, payload[f])
    await db.commit()
    await db.refresh(task)
    return serialize_task(task)

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, current_user: User = Depends(require_project_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProjectTask).where(ProjectTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task: raise HTTPException(status_code=404, detail="Not found")
    await db.delete(task)
    await db.commit()
    return {"message": "Task deleted"}

def serialize_project(r):
    return {"id": r.id, "name": r.name, "code": r.code, "factory_id": r.factory_id, "manager_user_id": r.manager_user_id, "start_date": str(r.start_date) if r.start_date else None, "end_date": str(r.end_date) if r.end_date else None, "status": r.status, "description": r.description, "is_active": r.is_active}

def serialize_task(r):
    return {"id": r.id, "project_id": r.project_id, "name": r.name, "assigned_to_user_id": r.assigned_to_user_id, "factory_id": r.factory_id, "planned_start_date": str(r.planned_start_date) if r.planned_start_date else None, "planned_end_date": str(r.planned_end_date) if r.planned_end_date else None, "actual_start_date": str(r.actual_start_date) if r.actual_start_date else None, "actual_end_date": str(r.actual_end_date) if r.actual_end_date else None, "progress_percent": r.progress_percent, "priority": r.priority, "stage": r.stage, "notes": r.notes, "is_active": r.is_active}
