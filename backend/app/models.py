from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    district: Mapped[str | None] = mapped_column(String(64))
    age: Mapped[int | None] = mapped_column(Integer)
    gender: Mapped[str | None] = mapped_column(String(16))
    current_status: Mapped[str | None] = mapped_column(String(64))
    education_level: Mapped[str | None] = mapped_column(String(64), index=True)
    english_proficiency: Mapped[int | None] = mapped_column(Integer)
    parents_education: Mapped[str | None] = mapped_column(String(64))
    has_study_space: Mapped[bool | None] = mapped_column(Boolean)
    income_bracket: Mapped[str | None] = mapped_column(String(64))
    primary_device: Mapped[str | None] = mapped_column(String(64))
    internet_quality: Mapped[int | None] = mapped_column(Integer)
    study_hours: Mapped[str | None] = mapped_column(String(32))
    software_literacy: Mapped[int | None] = mapped_column(Integer)
    library_distance: Mapped[str | None] = mapped_column(String(32))
    paid_resources: Mapped[str | None] = mapped_column(String(64))
    extracurricular: Mapped[str | None] = mapped_column(String(32))

    score: Mapped[int | None] = mapped_column(Integer)
    quiz_answers: Mapped[dict | None] = mapped_column(JSONB)

    # Original CSV row, preserved for auditability
    raw: Mapped[dict | None] = mapped_column(JSONB)


class IngestLog(Base):
    __tablename__ = "ingest_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ran_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    source: Mapped[str] = mapped_column(String(32))  # 'csv' | 'google_sheet'
    rows_seen: Mapped[int] = mapped_column(Integer, default=0)
    rows_inserted: Mapped[int] = mapped_column(Integer, default=0)
    rows_skipped: Mapped[int] = mapped_column(Integer, default=0)
    detail: Mapped[str | None] = mapped_column(String(512))
