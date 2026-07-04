"""Analysis engine: computes the 14-point breakdown for a qualification group,
plus overall dataset statistics used by the admin dashboard and decisions page.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from .models import SurveyResponse
from .normalization import CATEGORY_ORDERS, EDUCATION_LEVELS


def _distribution(rows, attr: str, order: list[str] | None = None) -> list[dict]:
    counts: dict[str, int] = {}
    for r in rows:
        val = getattr(r, attr)
        if val is None:
            continue
        key = "Yes" if val is True else "No" if val is False else str(val)
        counts[key] = counts.get(key, 0) + 1
    total = sum(counts.values()) or 1

    if order:
        keys = [k for k in order if k in counts] + [k for k in counts if k not in order]
    else:
        keys = sorted(counts, key=counts.get, reverse=True)

    return [
        {"label": k, "count": counts[k], "percentage": round(counts[k] * 100 / total, 1)}
        for k in keys
    ]


def _rating_summary(rows, attr: str) -> dict:
    values = [getattr(r, attr) for r in rows if getattr(r, attr) is not None]
    dist = [
        {"label": str(v), "count": values.count(v), "percentage": round(values.count(v) * 100 / len(values), 1) if values else 0}
        for v in range(1, 6)
    ]
    return {
        "average": round(sum(values) / len(values), 2) if values else None,
        "distribution": dist,
    }


def _score_summary(rows) -> dict:
    values = [r.score for r in rows if r.score is not None]
    dist = [
        {"label": f"{v}/5", "count": values.count(v), "percentage": round(values.count(v) * 100 / len(values), 1) if values else 0}
        for v in range(0, 6)
    ]
    return {
        "average": round(sum(values) / len(values), 2) if values else None,
        "distribution": dist,
        "high_performers_pct": round(sum(1 for v in values if v >= 4) * 100 / len(values), 1) if values else 0,
    }


def qualification_analysis(db: Session, education_level: str, district: str | None = None) -> dict:
    """The 14-point analysis for one qualification group, in the exact order
    required by the UI specification."""
    query = db.query(SurveyResponse)
    if district:
        query = query.filter(SurveyResponse.district == district)
    all_rows = query.all()
    rows = [r for r in all_rows if r.education_level == education_level]

    total = len(all_rows)
    group_scores = _score_summary(rows)
    overall_scores = _score_summary(all_rows)

    return {
        "education_level": education_level,
        "group_size": len(rows),
        "dataset_size": total,
        "sections": {
            "percentage": {
                "value": round(len(rows) * 100 / total, 1) if total else 0,
                "count": len(rows),
                "total": total,
            },
            "gender": _distribution(rows, "gender"),
            "english_proficiency": _rating_summary(rows, "english_proficiency"),
            "parents_education": _distribution(rows, "parents_education", CATEGORY_ORDERS["parents_education"]),
            "study_space": _distribution(rows, "has_study_space", ["Yes", "No"]),
            "income": _distribution(rows, "income_bracket", CATEGORY_ORDERS["income_bracket"]),
            "primary_device": _distribution(rows, "primary_device"),
            "internet_quality": _rating_summary(rows, "internet_quality"),
            "study_hours": _distribution(rows, "study_hours", CATEGORY_ORDERS["study_hours"]),
            "software_literacy": _rating_summary(rows, "software_literacy"),
            "library_distance": _distribution(rows, "library_distance", CATEGORY_ORDERS["library_distance"]),
            "external_resources": _distribution(rows, "paid_resources", CATEGORY_ORDERS["paid_resources"]),
            "extracurricular": _distribution(rows, "extracurricular", CATEGORY_ORDERS["extracurricular"]),
            "performance_score": {
                **group_scores,
                "overall_average": overall_scores["average"],
            },
        },
    }


def qualification_overview(db: Session, district: str | None = None) -> dict:
    """Counts and average scores for all six qualification levels (home page tabs)."""
    query = db.query(SurveyResponse)
    if district:
        query = query.filter(SurveyResponse.district == district)
    rows = query.all()
    total = len(rows)

    levels = []
    for level in EDUCATION_LEVELS:
        group = [r for r in rows if r.education_level == level]
        scores = [r.score for r in group if r.score is not None]
        levels.append(
            {
                "education_level": level,
                "count": len(group),
                "percentage": round(len(group) * 100 / total, 1) if total else 0,
                "average_score": round(sum(scores) / len(scores), 2) if scores else None,
            }
        )
    return {"total_responses": total, "levels": levels}


def overall_summary(db: Session) -> dict:
    """Dataset-wide summary for the admin dashboard."""
    rows = db.query(SurveyResponse).all()
    scores = [r.score for r in rows if r.score is not None]
    ages = [r.age for r in rows if r.age is not None]
    return {
        "total_responses": len(rows),
        "average_score": round(sum(scores) / len(scores), 2) if scores else None,
        "average_age": round(sum(ages) / len(ages), 1) if ages else None,
        "districts": _distribution(rows, "district"),
        "education_levels": _distribution(rows, "education_level", EDUCATION_LEVELS),
        "gender": _distribution(rows, "gender"),
        "current_status": _distribution(rows, "current_status"),
        "score_distribution": _score_summary(rows)["distribution"],
    }


def needs_analysis(db: Session) -> dict:
    """Resource gaps ("needs") per qualification group — what each group lacks."""
    rows = db.query(SurveyResponse).all()
    groups = []
    for level in EDUCATION_LEVELS:
        group = [r for r in rows if r.education_level == level]
        if not group:
            groups.append({"education_level": level, "group_size": 0, "needs": []})
            continue
        n = len(group)
        pct = lambda cond: round(sum(1 for r in group if cond(r)) * 100 / n, 1)

        needs = [
            {"need": "No dedicated study space at home", "affected_pct": pct(lambda r: r.has_study_space is False)},
            {"need": "Poor internet quality (rated 1-2)", "affected_pct": pct(lambda r: (r.internet_quality or 0) in (1, 2))},
            {"need": "Smartphone-only (no computer) for education", "affected_pct": pct(lambda r: r.primary_device == "Smartphone")},
            {"need": "No access to paid learning resources", "affected_pct": pct(lambda r: r.paid_resources == "No access at all")},
            {"need": "Low English proficiency (rated 1-2)", "affected_pct": pct(lambda r: (r.english_proficiency or 0) in (1, 2))},
            {"need": "Low software literacy (rated 1-2)", "affected_pct": pct(lambda r: (r.software_literacy or 0) in (1, 2))},
            {"need": "Library / higher-ed center over 10 km away", "affected_pct": pct(lambda r: r.library_distance == "More than 10 km")},
            {"need": "Household income below Rs. 50,000", "affected_pct": pct(lambda r: r.income_bracket == "Below Rs. 50,000")},
            {"need": "Never joins workshops or competitions", "affected_pct": pct(lambda r: r.extracurricular == "Never")},
        ]
        needs.sort(key=lambda x: x["affected_pct"], reverse=True)
        groups.append({"education_level": level, "group_size": n, "needs": needs})

    return {"groups": groups}
