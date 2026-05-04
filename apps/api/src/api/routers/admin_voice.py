from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission
from src.core.db.session import get_db
from src.models.voice_command import VoiceCommand

router = APIRouter(prefix="/admin/voice", tags=["voice"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "work_orders.view", "planning.view"):
        raise HTTPException(403, "Access denied")
    return user

@router.post("/command")
async def voice_command(command_text: str, action_type: str = None, result_text: str = None, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    cmd = VoiceCommand(user_id=user.id, command_text=command_text, action_type=action_type, result_text=result_text)
    db.add(cmd)
    await db.commit()
    return {"id": cmd.id}

@router.get("/history")
async def command_history(db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(select(VoiceCommand).where(VoiceCommand.user_id == user.id).order_by(VoiceCommand.id.desc()).limit(50))
    commands = result.scalars().all()
    return [{"id":c.id, "command_text":c.command_text, "result_text":c.result_text, "created_at":str(c.created_at)} for c in commands]
