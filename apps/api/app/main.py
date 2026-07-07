from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import agents, approvals, auth, dashboard, orgs, products
from app.core.config import get_settings
from app.core.database import Base, engine

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Convenience for development; production deploys run `alembic upgrade head`.
    if settings.environment == "development":
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "Autonomous AI dropshipping operator: a Claude CEO agent coordinates specialist "
        "agents with human approval gates on high-risk actions."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


app.include_router(auth.router)
app.include_router(orgs.router)
app.include_router(products.router)
app.include_router(agents.router)
app.include_router(approvals.router)
app.include_router(dashboard.router)
