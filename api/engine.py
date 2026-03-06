# Vercel Python serverless function — FastAPI BFS engine entry point
# engine/app/config.py의 supabase 의존성을 우회해 라우터만 직접 임포트
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from engine.app.routers import scoring, onboarding

app = FastAPI(title="MuscleTailors Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scoring.router,    prefix="/api/scoring")
app.include_router(onboarding.router, prefix="/api/onboarding")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "muscle-tailors-engine"}
