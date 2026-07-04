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
import re

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


def to_csv_export_url(url: str) -> str:
    """Accept any Google Sheets link — a regular share/edit link, a
    publish-to-web link, or an already-direct CSV link — and return a URL
    that serves the sheet as CSV.

    Share links require the sheet to be shared as 'Anyone with the link: Viewer'.
    """
    url = url.strip()
    if "output=csv" in url or "format=csv" in url:
        return url
    if "/spreadsheets/d/e/" in url:  # publish-to-web link (pubhtml / pub)
        return re.sub(r"/(pubhtml|pub)([/?#].*)?$", "/pub", url) + "?output=csv"
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    if m:
        return f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv"
    return url


def ingest_google_sheet(db: Session, csv_url: str) -> IngestLog:
    resp = requests.get(to_csv_export_url(csv_url), timeout=30)
    resp.raise_for_status()
    content_type = resp.headers.get("content-type", "")
    if "text/csv" not in content_type and "text/plain" not in content_type:
        raise ValueError(
            "Google Sheet did not return CSV — make sure the sheet is shared as "
            "'Anyone with the link: Viewer' (or published to the web as CSV)."
        )
    rows = list(csv.DictReader(io.StringIO(resp.content.decode("utf-8-sig"))))
    return ingest_rows(db, rows, source="google_sheet")
