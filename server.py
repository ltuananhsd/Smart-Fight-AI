#!/usr/bin/env python3
"""
Travel Optimization Engine — Web Server
FastAPI entry point with CORS, static files, and API routers.

Run: uvicorn server:app --reload
"""

import os
import sys
from pathlib import Path

# Ensure scripts/ is importable
sys.path.insert(0, str(Path(__file__).parent / "scripts"))

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.chat_router import router as chat_router
from routers.search_router import router as search_router
from routers.health_router import router as health_router
from routers.compare_router import router as compare_router

app = FastAPI(
    title="Travel Optimization Engine",
    description="AI-powered flight search and cost optimization",
    version="2.1.0",
)

# CORS (allow local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(search_router, prefix="/api", tags=["search"])
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(compare_router, prefix="/api", tags=["compare"])

@app.get("/")
async def root_health():
    """Health check for the root endpoint."""
    return {"message": "Travel Optimization Engine API", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("server:app", host=host, port=port, reload=True)
