from fastapi import APIRouter, Header
from pydantic import BaseModel

router = APIRouter()


class OnboardingData(BaseModel):
    age: int
    height: float
    weight: float
    gender: str
    body_fat: float | None = None
    muscle_mass: float | None = None
    upper_arm: float | None = None
    forearm: float | None = None
    thigh: float | None = None
    shin: float | None = None
    pain_areas: list[str] = []
    pain_areas_slight: list[str] = []
    equipment: list[str]
    goal: str
    strength_exp: str
    gym_exp: str
    rm_squat: float | None = None
    rm_bench: float | None = None
    rm_deadlift: float | None = None
    rm_row: float | None = None
    rm_ohp: float | None = None


@router.post("/submit")
async def submit_onboarding(
    data: OnboardingData,
    x_user_id: str = Header(...),
):
    """온보딩 데이터를 받아 초기 BFS 스코어를 계산합니다."""
    # TODO: Supabase에 저장 + BFS 초기 계산
    return {
        "user_id": x_user_id,
        "status": "received",
        "data": data.model_dump(),
    }
