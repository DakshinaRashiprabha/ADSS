"""ML layer: trains a model that predicts whether a respondent is a high
performer (aptitude score >= 4/5) from socio-economic factors, and exposes
feature importances so the decisions engine can explain WHICH factors drive
intellectual performance gaps.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score

from sqlalchemy.orm import Session

from .models import SurveyResponse
from .normalization import (
    EDUCATION_LEVELS,
    INCOME_BRACKETS,
    LIBRARY_DISTANCES,
    PAID_RESOURCES,
    PARENTS_EDUCATION,
    STUDY_HOURS,
    EXTRACURRICULAR,
)

logger = logging.getLogger(__name__)

HIGH_PERFORMER_THRESHOLD = 4

# Ordinal encodings for ordered categories
_ORDINAL = {
    "education_level": EDUCATION_LEVELS,
    "income_bracket": INCOME_BRACKETS,
    "library_distance": LIBRARY_DISTANCES,
    "paid_resources": PAID_RESOURCES,
    "parents_education": PARENTS_EDUCATION,
    "study_hours": STUDY_HOURS,
    "extracurricular": EXTRACURRICULAR,
}

FEATURE_LABELS = {
    "english_proficiency": "English proficiency",
    "software_literacy": "Software literacy",
    "internet_quality": "Internet quality",
    "education_level": "Education level",
    "income_bracket": "Household income",
    "parents_education": "Parents' education",
    "study_hours": "Daily online study hours",
    "library_distance": "Distance to library/university",
    "paid_resources": "Access to paid resources",
    "extracurricular": "Extracurricular participation",
    "has_study_space": "Dedicated study space",
    "is_female": "Gender (female)",
    "uses_computer": "Uses laptop/desktop",
    "age": "Age",
}


@dataclass
class TrainedModel:
    model: RandomForestClassifier
    feature_names: list[str]
    n_samples: int = 0
    cv_accuracy: float | None = None
    baseline_accuracy: float | None = None
    feature_importances: list[dict] = field(default_factory=list)


_cache: TrainedModel | None = None


def _to_frame(rows: list[SurveyResponse]) -> pd.DataFrame:
    records = []
    for r in rows:
        if r.score is None:
            continue
        rec = {
            "age": r.age,
            "english_proficiency": r.english_proficiency,
            "software_literacy": r.software_literacy,
            "internet_quality": r.internet_quality,
            "has_study_space": None if r.has_study_space is None else int(r.has_study_space),
            "is_female": None if r.gender is None else int(r.gender == "Female"),
            "uses_computer": None if r.primary_device is None else int(r.primary_device == "Laptop / Desktop"),
            "high_performer": int(r.score >= HIGH_PERFORMER_THRESHOLD),
        }
        for col, order in _ORDINAL.items():
            val = getattr(r, col)
            rec[col] = order.index(val) if val in order else None
        records.append(rec)
    return pd.DataFrame(records)


def train_model(db: Session) -> TrainedModel:
    global _cache
    rows = db.query(SurveyResponse).all()
    df = _to_frame(rows)
    if len(df) < 20:
        raise ValueError(f"Not enough labeled data to train (have {len(df)}, need 20+)")

    feature_names = [c for c in df.columns if c != "high_performer"]
    X = df[feature_names].fillna(df[feature_names].median())
    y = df["high_performer"]

    model = RandomForestClassifier(n_estimators=300, max_depth=6, random_state=42, class_weight="balanced")
    cv_folds = min(5, y.value_counts().min())
    cv_acc = cross_val_score(model, X, y, cv=cv_folds).mean() if cv_folds >= 2 else None
    model.fit(X, y)

    importances = sorted(
        (
            {
                "feature": name,
                "label": FEATURE_LABELS.get(name, name),
                "importance": round(float(imp), 4),
            }
            for name, imp in zip(feature_names, model.feature_importances_)
        ),
        key=lambda d: d["importance"],
        reverse=True,
    )

    _cache = TrainedModel(
        model=model,
        feature_names=feature_names,
        n_samples=len(df),
        cv_accuracy=round(float(cv_acc), 3) if cv_acc is not None else None,
        baseline_accuracy=round(float(max(y.mean(), 1 - y.mean())), 3),
        feature_importances=importances,
    )
    logger.info("Model trained on %d samples, CV accuracy %.3f", len(df), cv_acc or -1)
    return _cache


def get_model(db: Session) -> TrainedModel:
    return _cache or train_model(db)


def model_info(db: Session) -> dict:
    tm = get_model(db)
    return {
        "algorithm": "Random Forest (300 trees)",
        "target": f"High performer (aptitude score >= {HIGH_PERFORMER_THRESHOLD}/5)",
        "n_samples": tm.n_samples,
        "cv_accuracy": tm.cv_accuracy,
        "baseline_accuracy": tm.baseline_accuracy,
        "feature_importances": tm.feature_importances,
    }
