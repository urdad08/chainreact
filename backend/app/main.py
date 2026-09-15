from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.synthesize import router as synthesize_router

app = FastAPI(
    title="ChainReact",
    description=(
        "Agent-building-agent system: requirement -> spec -> agents -> workflow -> "
        "sandbox -> repair -> audited deployment gate -> runtime execution."
    ),
    version="0.3.0",
)

# Local dev origins are always allowed. In production, set FRONTEND_ORIGIN to your
# deployed frontend's URL (e.g. https://your-app.vercel.app) -- comma-separate if you
# have more than one (a Vercel preview URL plus your production domain, for example).
_default_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
_extra_origins = [o.strip() for o in os.environ.get("FRONTEND_ORIGIN", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(synthesize_router)


@app.get("/health")
def health():
    return {"status": "ok"}
