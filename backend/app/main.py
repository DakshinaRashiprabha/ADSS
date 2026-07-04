"""FastAPI application for the Automated Decision Support System —
Analyzing and Optimizing Intellectual Inequality (Ampara District, Sri Lanka).
"""

from __future__ import annotations

import asyncio
import logging
import secrets

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import analysis, decisions, ingest, ml
from .config import ADMIN_PASSWORD, ADMIN_USERNAME, CSV_PATH, GOOGLE_SHEET_CSV_URL, SYNC_INTERVAL_MINUTES
from .database import Base, SessionLocal, engine, get_db
from .models import IngestLog, SupportRequest, SurveyResponse
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
        if db.query(func.count(SurveyResponse.id)).scalar() == 0:
            # Prefer the live Google Sheet; fall back to the bundled CSV.
            if GOOGLE_SHEET_CSV_URL:
                try:
                    log = ingest.ingest_google_sheet(db, GOOGLE_SHEET_CSV_URL)
                    logger.info("Seeded database from Google Sheet: %s", log.detail)
                except Exception:
                    logger.exception("Google Sheet seed failed — falling back to local CSV")
                    if CSV_PATH.exists():
                        log = ingest.ingest_csv_file(db, CSV_PATH)
                        logger.info("Seeded database from CSV: %s", log.detail)
            elif CSV_PATH.exists():
                log = ingest.ingest_csv_file(db, CSV_PATH)
                logger.info("Seeded database from CSV: %s", log.detail)
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


# --- Support requests (public Comments tab) ----------------------------------

MAX_DOCUMENT_BYTES = 10 * 1024 * 1024  # 10 MB


def _support_public(r: SupportRequest) -> dict:
    return {
        "id": r.id,
        "created_at": r.created_at.isoformat(),
        "name": r.name,
        "contact_no": r.contact_no,
        "address": r.address,
        "description": r.description,
        "has_document": r.document_name is not None,
        "document_name": r.document_name,
    }


@app.post("/api/support")
async def submit_support_request(
    name: str = Form(...),
    contact_no: str = Form(...),
    address: str = Form(...),
    description: str = Form(...),
    document: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    req = SupportRequest(
        name=name.strip(),
        contact_no=contact_no.strip(),
        address=address.strip(),
        description=description.strip(),
    )
    if not (req.name and req.contact_no and req.address and req.description):
        raise HTTPException(400, "Name, contact number, address, and requirement description are all required")
    if document is not None and document.filename:
        data = await document.read()
        if len(data) > MAX_DOCUMENT_BYTES:
            raise HTTPException(400, "Document too large (max 10 MB)")
        req.document_name = document.filename
        req.document_type = document.content_type or "application/octet-stream"
        req.document_data = data
    db.add(req)
    db.commit()
    return {"id": req.id, "status": req.status}


@app.get("/api/support/approved")
def approved_support_requests(db: Session = Depends(get_db)):
    rows = (
        db.query(SupportRequest)
        .filter(SupportRequest.status == "approved")
        .order_by(SupportRequest.created_at.desc())
        .all()
    )
    return [_support_public(r) for r in rows]


@app.get("/api/support/{req_id}/document")
def support_document(req_id: int, db: Session = Depends(get_db)):
    r = db.get(SupportRequest, req_id)
    if r is None or r.document_data is None:
        raise HTTPException(404, "Document not found")
    return Response(
        content=r.document_data,
        media_type=r.document_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{r.document_name}"'},
    )


# --- Admin -------------------------------------------------------------------

# Session tokens issued by /api/admin/login; valid until the server restarts.
_admin_tokens: set[str] = set()


def require_admin(authorization: str | None = Header(None)) -> None:
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not token or token not in _admin_tokens:
        raise HTTPException(401, "Admin authentication required")


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/admin/login")
def admin_login(req: LoginRequest):
    user_ok = secrets.compare_digest(req.username.encode(), ADMIN_USERNAME.encode())
    pass_ok = secrets.compare_digest(req.password.encode(), ADMIN_PASSWORD.encode())
    if not (user_ok and pass_ok):
        raise HTTPException(401, "Invalid username or password")
    token = secrets.token_hex(32)
    _admin_tokens.add(token)
    return {"token": token}


@app.get("/api/admin/support", dependencies=[Depends(require_admin)])
def admin_support_requests(db: Session = Depends(get_db)):
    rows = db.query(SupportRequest).order_by(SupportRequest.created_at.desc()).all()
    return [{**_support_public(r), "status": r.status} for r in rows]


class SupportStatusUpdate(BaseModel):
    status: str


@app.post("/api/admin/support/{req_id}/status", dependencies=[Depends(require_admin)])
def admin_update_support_status(req_id: int, update: SupportStatusUpdate, db: Session = Depends(get_db)):
    if update.status not in ("pending", "approved", "rejected"):
        raise HTTPException(400, "Status must be one of: pending, approved, rejected")
    r = db.get(SupportRequest, req_id)
    if r is None:
        raise HTTPException(404, "Support request not found")
    r.status = update.status
    db.commit()
    return {"id": r.id, "status": r.status}

@app.get("/api/admin/summary", dependencies=[Depends(require_admin)])
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


@app.post("/api/admin/ingest", dependencies=[Depends(require_admin)])
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


@app.post("/api/admin/retrain", dependencies=[Depends(require_admin)])
def admin_retrain(db: Session = Depends(get_db)):
    try:
        ml.train_model(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return ml.model_info(db)


@app.get("/api/health")
def health():
    return {"status": "ok"}
