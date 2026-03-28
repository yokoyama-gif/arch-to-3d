"""FastAPI application entry point for the sky factor study tool."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.estimate_routes import router as estimate_router
from app.config import CORS_ORIGINS

app = FastAPI(
    title="Sky Factor Study API",
    description="建築ボリュームの天空率を初期検討するための API",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(estimate_router)


@app.get("/")
async def root():
    return {"message": "Sky Factor Study API", "version": "0.2.0"}
