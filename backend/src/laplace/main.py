from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from laplace.config import settings
from laplace.routers import backtest, datasets, diagnostics, export, forecast, preprocessing

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(diagnostics.router)
app.include_router(forecast.router)
app.include_router(backtest.router)
app.include_router(export.router)
app.include_router(preprocessing.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
