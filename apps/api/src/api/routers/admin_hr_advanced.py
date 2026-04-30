from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.hr_advanced import HrJobPosition, HrApplicant, HrContract

router = APIRouter(prefix="/admin/hr-advanced", tags=["admin-hr-advanced"])

async def require_hr_advanced_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "hr_advanced.view", "hr_advanced.manage"):
        raise HTTPException(status_code=403, detail="HR Advanced access denied")
    return user

@router.get("/jobs")
async def list_jobs(current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HrJobPosition).order_by(HrJobPosition.id.asc()))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code,"department_id":r.department_id,"description":r.description} for r in rows]

@router.post("/jobs", status_code=status.HTTP_201_CREATED)
async def create_job(payload: dict, current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    job = HrJobPosition(name=payload["name"], code=payload["code"], department_id=payload.get("department_id"), description=payload.get("description"))
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"id":job.id,"name":job.name,"code":job.code}

@router.put("/jobs/{job_id}")
async def update_job(job_id: int, payload: dict, current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HrJobPosition).where(HrJobPosition.id == job_id))
    job = result.scalar_one_or_none()
    if not job: raise HTTPException(status_code=404, detail="Job not found")
    for field in ["name","code","department_id","description"]:
        if field in payload: setattr(job, field, payload[field])
    await db.commit()
    await db.refresh(job)
    return {"id":job.id,"name":job.name,"code":job.code}

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: int, current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HrJobPosition).where(HrJobPosition.id == job_id))
    job = result.scalar_one_or_none()
    if not job: raise HTTPException(status_code=404, detail="Job not found")
    await db.delete(job)
    await db.commit()
    return {"message":"Job deleted"}

@router.get("/applicants")
async def list_applicants(current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HrApplicant).order_by(HrApplicant.id.desc()).limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"job_id":r.job_id,"first_name":r.first_name,"last_name":r.last_name,"email":r.email,"phone":r.phone,"status":r.status,"notes":r.notes} for r in rows]

@router.post("/applicants", status_code=status.HTTP_201_CREATED)
async def create_applicant(payload: dict, current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    applicant = HrApplicant(job_id=payload.get("job_id"), first_name=payload["first_name"], last_name=payload["last_name"], email=payload.get("email"), phone=payload.get("phone"), status=payload.get("status","new"), notes=payload.get("notes"))
    db.add(applicant)
    await db.commit()
    await db.refresh(applicant)
    return {"id":applicant.id,"first_name":applicant.first_name,"last_name":applicant.last_name}

@router.put("/applicants/{applicant_id}")
async def update_applicant(applicant_id: int, payload: dict, current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HrApplicant).where(HrApplicant.id == applicant_id))
    applicant = result.scalar_one_or_none()
    if not applicant: raise HTTPException(status_code=404, detail="Applicant not found")
    for field in ["job_id","first_name","last_name","email","phone","status","notes"]:
        if field in payload: setattr(applicant, field, payload[field])
    await db.commit()
    await db.refresh(applicant)
    return {"id":applicant.id,"first_name":applicant.first_name,"last_name":applicant.last_name}

@router.delete("/applicants/{applicant_id}")
async def delete_applicant(applicant_id: int, current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HrApplicant).where(HrApplicant.id == applicant_id))
    applicant = result.scalar_one_or_none()
    if not applicant: raise HTTPException(status_code=404, detail="Applicant not found")
    await db.delete(applicant)
    await db.commit()
    return {"message":"Applicant deleted"}

@router.get("/contracts")
async def list_contracts(current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HrContract).order_by(HrContract.id.desc()).limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"employee_id":r.employee_id,"contract_type":r.contract_type,"start_date":str(r.start_date),"end_date":str(r.end_date) if r.end_date else None,"job_title":r.job_title,"salary_amount":float(r.salary_amount) if r.salary_amount else None,"status":r.status,"notes":r.notes} for r in rows]

@router.post("/contracts", status_code=status.HTTP_201_CREATED)
async def create_contract(payload: dict, current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    contract = HrContract(employee_id=payload["employee_id"], contract_type=payload.get("contract_type","permanent"), start_date=payload.get("start_date"), end_date=payload.get("end_date"), job_title=payload.get("job_title"), department_id=payload.get("department_id"), salary_amount=payload.get("salary_amount"), status=payload.get("status","active"), notes=payload.get("notes"))
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return {"id":contract.id,"employee_id":contract.employee_id,"status":contract.status}

@router.put("/contracts/{contract_id}")
async def update_contract(contract_id: int, payload: dict, current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HrContract).where(HrContract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract: raise HTTPException(status_code=404, detail="Contract not found")
    for field in ["employee_id","contract_type","start_date","end_date","job_title","department_id","salary_amount","status","notes"]:
        if field in payload: setattr(contract, field, payload[field])
    await db.commit()
    await db.refresh(contract)
    return {"id":contract.id,"employee_id":contract.employee_id,"status":contract.status}

@router.delete("/contracts/{contract_id}")
async def delete_contract(contract_id: int, current_user: User = Depends(require_hr_advanced_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HrContract).where(HrContract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract: raise HTTPException(status_code=404, detail="Contract not found")
    await db.delete(contract)
    await db.commit()
    return {"message":"Contract deleted"}
