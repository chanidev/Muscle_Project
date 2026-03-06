from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import scoring, onboarding

app = FastAPI(
    title="MuscleTailors Analysis Engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.bff_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])
app.include_router(scoring.router,    prefix="/api/scoring",    tags=["scoring"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "muscle-tailors-engine"}
