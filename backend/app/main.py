"""FastAPI application for the Automated Decision Support System —
Analyzing and Optimizing Intellectual Inequality (Ampara District, Sri Lanka).
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import analysis, decisions, ingest, ml, quiz
from .config import CSV_PATH, GOOGLE_SHEET_CSV_URL, SYNC_INTERVAL_MINUTES
from .database import Base, SessionLocal, engine, get_db
from .models import IngestLog, SurveyResponse
from .normalization import EDUCATION_LEVELS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ampara DSS API",
    description="Automated Decision Support System for Analyzing and Optimizing Intellectual Inequality",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        if db.query(func.count(SurveyResponse.id)).scalar() == 0 and CSV_PATH.exists():
            log = ingest.ingest_csv_file(db, CSV_PATH)
            logger.info("Seeded database: %s", log.detail)
        try:
            ml.train_model(db)
        except ValueError as e:
            logger.warning("Model not trained: %s", e)
    finally:
        db.close()

    if GOOGLE_SHEET_CSV_URL and SYNC_INTERVAL_MINUTES > 0:
        asyncio.get_event_loop().create_task(_sheet_sync_loop())


async def _sheet_sync_loop() -> None:
    """Automation: periodically pull new responses from the published Google Sheet."""
    while True:
        await asyncio.sleep(SYNC_INTERVAL_MINUTES * 60)
        db = SessionLocal()
        try:
            log = ingest.ingest_google_sheet(db, GOOGLE_SHEET_CSV_URL)
            if log.rows_inserted:
                ml.train_model(db)
        except Exception:
            logger.exception("Scheduled Google Sheet sync failed")
        finally:
            db.close()


# --- Public API --------------------------------------------------------------

@app.get("/api/overview")
def overview(district: str | None = None, db: Session = Depends(get_db)):
    return analysis.qualification_overview(db, district)


@app.get("/api/analysis")
def qualification_analysis(
    level: str = Query(..., description="One of the six education levels"),
    district: str | None = None,
    db: Session = Depends(get_db),
):
    if level not in EDUCATION_LEVELS:
        raise HTTPException(400, f"Unknown education level '{level}'. Valid: {EDUCATION_LEVELS}")
    return analysis.qualification_analysis(db, level, district)


@app.get("/api/decisions")
def get_decisions(db: Session = Depends(get_db)):
    return decisions.decisions(db)


@app.get("/api/decisions/group")
def get_group_decisions(
    level: str = Query(..., description="One of the six education levels"),
    db: Session = Depends(get_db),
):
    if level not in EDUCATION_LEVELS:
        raise HTTPException(400, f"Unknown education level '{level}'. Valid: {EDUCATION_LEVELS}")
    return decisions.group_decisions(db, level)


@app.get("/api/needs")
def get_needs(db: Session = Depends(get_db)):
    return analysis.needs_analysis(db)


@app.get("/api/districts")
def districts(db: Session = Depends(get_db)):
    rows = (
        db.query(SurveyResponse.district, func.count(), func.avg(SurveyResponse.score))
        .group_by(SurveyResponse.district)
        .all()
    )
    return sorted(
        (
            {"district": d, "count": c, "average_score": round(float(avg), 2) if avg is not None else None}
            for d, c, avg in rows
            if d
        ),
        key=lambda x: x["count"],
        reverse=True,
    )


# --- Try Questions -----------------------------------------------------------

class QuizSubmission(BaseModel):
    answers: dict[str, str]


@app.get("/api/quiz/questions")
def quiz_questions():
    return quiz.public_questions()


@app.post("/api/quiz/submit")
def quiz_submit(submission: QuizSubmission, db: Session = Depends(get_db)):
    return quiz.grade(db, submission.answers)


# --- Admin -------------------------------------------------------------------

@app.get("/api/admin/summary")
def admin_summary(db: Session = Depends(get_db)):
    logs = db.query(IngestLog).order_by(IngestLog.ran_at.desc()).limit(10).all()
    try:
        model = ml.model_info(db)
    except ValueError as e:
        model = {"error": str(e)}
    return {
        "dataset": analysis.overall_summary(db),
        "model": model,
        "ingest_logs": [
            {
                "ran_at": log.ran_at.isoformat(),
                "source": log.source,
                "rows_seen": log.rows_seen,
                "rows_inserted": log.rows_inserted,
                "rows_skipped": log.rows_skipped,
            }
            for log in logs
        ],
        "sheet_sync": {
            "configured": bool(GOOGLE_SHEET_CSV_URL),
            "interval_minutes": SYNC_INTERVAL_MINUTES,
        },
    }


@app.post("/api/admin/ingest")
def admin_ingest(db: Session = Depends(get_db)):
    """Re-run ingestion: Google Sheet if configured, otherwise the local CSV."""
    if GOOGLE_SHEET_CSV_URL:
        log = ingest.ingest_google_sheet(db, GOOGLE_SHEET_CSV_URL)
    elif CSV_PATH.exists():
        log = ingest.ingest_csv_file(db, CSV_PATH)
    else:
        raise HTTPException(400, "No data source configured (CSV missing and no Google Sheet URL)")
    if log.rows_inserted:
        ml.train_model(db)
    return {"source": log.source, "rows_seen": log.rows_seen, "rows_inserted": log.rows_inserted, "rows_skipped": log.rows_skipped}


@app.post("/api/admin/retrain")
def admin_retrain(db: Session = Depends(get_db)):
    try:
        ml.train_model(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return ml.model_info(db)


@app.get("/api/health")
def health():
    return {"status": "ok"}
