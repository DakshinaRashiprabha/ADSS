"""Ingestion pipeline: CSV file or published Google Sheet -> normalize -> PostgreSQL.

Deduplication key: the submission timestamp + raw row content hash, so re-running
ingestion (or the scheduled Google Sheet sync) only inserts new responses.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging

import requests
from sqlalchemy.orm import Session

from .models import IngestLog, SurveyResponse
from .normalization import normalize_row

logger = logging.getLogger(__name__)


def _row_hash(raw_row: dict) -> str:
    return hashlib.sha256(json.dumps(raw_row, sort_keys=True).encode()).hexdigest()


def _existing_hashes(db: Session) -> set[str]:
    hashes = set()
    for (raw,) in db.query(SurveyResponse.raw).all():
        if raw:
            hashes.add(_row_hash(raw))
    return hashes


def ingest_rows(db: Session, raw_rows: list[dict], source: str) -> IngestLog:
    seen = _existing_hashes(db)
    inserted = skipped = 0

    for raw_row in raw_rows:
        h = _row_hash(raw_row)
        if h in seen:
            skipped += 1
            continue
        seen.add(h)
        db.add(SurveyResponse(**normalize_row(raw_row)))
        inserted += 1

    log = IngestLog(
        source=source,
        rows_seen=len(raw_rows),
        rows_inserted=inserted,
        rows_skipped=skipped,
        detail=f"{inserted} new responses ingested from {source}",
    )
    db.add(log)
    db.commit()
    logger.info("Ingest from %s: %d seen, %d inserted, %d skipped", source, len(raw_rows), inserted, skipped)
    return log


def ingest_csv_file(db: Session, path) -> IngestLog:
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    return ingest_rows(db, rows, source="csv")


def ingest_google_sheet(db: Session, csv_url: str) -> IngestLog:
    resp = requests.get(csv_url, timeout=30)
    resp.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(resp.content.decode("utf-8-sig"))))
    return ingest_rows(db, rows, source="google_sheet")
