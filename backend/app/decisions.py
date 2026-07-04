"""Decision engine: turns the analyzed data + trained ML model into
evidence-backed findings and prioritized recommendations — the "Decisions"
page of the system.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from .analysis import needs_analysis
from .ml import get_model, model_info
from .models import SurveyResponse
from .normalization import CATEGORY_ORDERS

# Factors compared for score gaps: attribute -> (readable name, value order or None)
_GAP_FACTORS = {
    "income_bracket": ("Household income", CATEGORY_ORDERS["income_bracket"]),
    "parents_education": ("Parents' education", CATEGORY_ORDERS["parents_education"]),
    "gender": ("Gender", ["Female", "Male"]),
    "primary_device": ("Primary learning device", None),
    "has_study_space": ("Dedicated study space", ["Yes", "No"]),
    "paid_resources": ("Access to paid resources", CATEGORY_ORDERS["paid_resources"]),
    "library_distance": ("Distance to library", CATEGORY_ORDERS["library_distance"]),
    "study_hours": ("Daily online study hours", CATEGORY_ORDERS["study_hours"]),
    "extracurricular": ("Extracurricular participation", CATEGORY_ORDERS["extracurricular"]),
}

MIN_GROUP = 5  # groups smaller than this are excluded from gap comparisons


def _avg_score_by(rows, attr: str, order: list[str] | None) -> list[dict]:
    buckets: dict[str, list[int]] = {}
    for r in rows:
        val = getattr(r, attr)
        if val is None or r.score is None:
            continue
        key = "Yes" if val is True else "No" if val is False else str(val)
        buckets.setdefault(key, []).append(r.score)

    keys = [k for k in (order or sorted(buckets))] if order else sorted(buckets)
    keys = [k for k in keys if k in buckets]
    return [
        {"label": k, "average_score": round(sum(buckets[k]) / len(buckets[k]), 2), "count": len(buckets[k])}
        for k in keys
    ]


def _gini(values: list[float]) -> float:
    """Gini coefficient — 0 is perfect equality, 1 is maximal inequality."""
    vals = sorted(v for v in values if v is not None)
    n = len(vals)
    total = sum(vals)
    if n == 0 or total == 0:
        return 0.0
    cum = sum((i + 1) * v for i, v in enumerate(vals))
    return round((2 * cum) / (n * total) - (n + 1) / n, 3)


def score_gaps(db: Session) -> list[dict]:
    """For each socio-economic factor: average score per level and the gap
    between best- and worst-scoring levels (with small groups excluded)."""
    rows = db.query(SurveyResponse).all()
    gaps = []
    for attr, (name, order) in _GAP_FACTORS.items():
        groups = [g for g in _avg_score_by(rows, attr, order) if g["count"] >= MIN_GROUP]
        if len(groups) < 2:
            continue
        best = max(groups, key=lambda g: g["average_score"])
        worst = min(groups, key=lambda g: g["average_score"])
        gaps.append(
            {
                "factor": name,
                "attribute": attr,
                "groups": groups,
                "gap": round(best["average_score"] - worst["average_score"], 2),
                "best": best,
                "worst": worst,
            }
        )
    gaps.sort(key=lambda g: g["gap"], reverse=True)
    return gaps


RULES = [
        ("Low English proficiency (rated 1-2)", 15,
         "Launch subsidized English language programs (spoken + written), prioritizing groups below A/L qualification.",
         "English proficiency is a top predictor of aptitude performance in the trained model."),
        ("Poor internet quality (rated 1-2)", 20,
         "Negotiate subsidized education data packages and expand rural network coverage with telecom providers.",
         "Respondents rating their connection 1-2 cannot benefit from online learning resources."),
        ("Smartphone-only (no computer) for education", 30,
         "Set up shared computer labs / device-lending libraries at divisional secretariat level.",
         "A majority studying only on smartphones limits software literacy and deep study."),
        ("No access to paid learning resources", 20,
         "Provide vouchers or free institutional licenses for online learning platforms to low-income households.",
         "Paid-resource access correlates with higher aptitude scores in the gap analysis."),
        ("Library / higher-ed center over 10 km away", 15,
         "Deploy mobile library services and weekend study hubs in remote divisions.",
         "Distance to knowledge infrastructure is a measurable barrier for remote respondents."),
        ("No dedicated study space at home", 15,
         "Open supervised community study centers with evening hours in high-need areas.",
         "Respondents without a quiet study space score measurably lower."),
        ("Never joins workshops or competitions", 10,
         "Run district-level workshop and competition circuits with transport support to raise participation.",
         "Extracurricular engagement is associated with higher performance scores."),
        ("Low software literacy (rated 1-2)", 20,
         "Introduce free ICT / digital-skills certification courses at vocational centers.",
         "Software literacy ranks among the strongest model predictors of high performance."),
        ("Household income below Rs. 50,000", 20,
         "Target scholarships and stipends at students from households earning below Rs. 50,000.",
         "Income shows one of the largest average-score gaps between its highest and lowest brackets."),
]


def _build_recs(affected_pcts: dict[str, float]) -> list[dict]:
    """Apply the intervention rules to a set of {need: affected %} figures."""
    recs = []
    for need_key, threshold, action, why in RULES:
        affected = round(affected_pcts.get(need_key, 0), 1)
        if affected >= threshold:
            recs.append(
                {
                    "priority": "High" if affected >= 2 * threshold else "Medium",
                    "issue": need_key,
                    "affected_pct": affected,
                    "recommendation": action,
                    "evidence": why,
                }
            )
    recs.sort(key=lambda r: (r["priority"] != "High", -r["affected_pct"]))
    return recs


def _recommendations(db: Session, gaps: list[dict]) -> list[dict]:
    """Dataset-wide recommendations: needs aggregated across all groups,
    weighted by group size."""
    needs = needs_analysis(db)
    total = sum(g["group_size"] for g in needs["groups"]) or 1
    agg: dict[str, float] = {}
    for g in needs["groups"]:
        for n in g["needs"]:
            agg[n["need"]] = agg.get(n["need"], 0) + n["affected_pct"] * g["group_size"] / total
    return _build_recs(agg)


def group_decisions(db: Session, education_level: str) -> dict:
    """Decisions specific to ONE qualification group: its own barriers run
    through the same intervention rules, plus how it compares overall."""
    rows = db.query(SurveyResponse).all()
    group = [r for r in rows if r.education_level == education_level]
    group_scores = [r.score for r in group if r.score is not None]
    all_scores = [r.score for r in rows if r.score is not None]

    needs = needs_analysis(db)
    group_needs = next(
        (g["needs"] for g in needs["groups"] if g["education_level"] == education_level), []
    )
    pcts = {n["need"]: n["affected_pct"] for n in group_needs}

    avg = round(sum(group_scores) / len(group_scores), 2) if group_scores else None
    overall = round(sum(all_scores) / len(all_scores), 2) if all_scores else None

    findings = []
    if avg is not None and overall is not None:
        diff = round(avg - overall, 2)
        direction = "above" if diff >= 0 else "below"
        findings.append(
            f"This group averages {avg}/5 on the aptitude test — {abs(diff)} points {direction} "
            f"the overall average of {overall}/5."
        )
    top_barriers = [n for n in group_needs if n["affected_pct"] >= 30][:3]
    for b in top_barriers:
        findings.append(f"{b['affected_pct']}% of this group: {b['need'].lower()}.")

    return {
        "education_level": education_level,
        "group_size": len(group),
        "average_score": avg,
        "overall_average": overall,
        "high_performer_pct": round(sum(1 for s in group_scores if s >= 4) * 100 / len(group_scores), 1)
        if group_scores
        else 0,
        "key_findings": findings,
        "top_barriers": group_needs[:5],
        "recommendations": _build_recs(pcts),
    }


def decisions(db: Session) -> dict:
    rows = db.query(SurveyResponse).all()
    scores = [r.score for r in rows if r.score is not None]
    gaps = score_gaps(db)

    try:
        get_model(db)
        ml = model_info(db)
    except ValueError as e:
        ml = {"error": str(e)}

    key_findings = []
    for g in gaps[:5]:
        key_findings.append(
            f"{g['factor']}: respondents in '{g['best']['label']}' average "
            f"{g['best']['average_score']}/5 vs {g['worst']['average_score']}/5 for "
            f"'{g['worst']['label']}' — a gap of {g['gap']} points."
        )
    if ml.get("feature_importances"):
        top = ", ".join(f["label"] for f in ml["feature_importances"][:3])
        key_findings.append(f"The ML model identifies {top} as the strongest predictors of high aptitude performance.")

    return {
        "summary": {
            "total_responses": len(rows),
            "average_score": round(sum(scores) / len(scores), 2) if scores else None,
            "score_gini": _gini(scores),
            "high_performer_pct": round(sum(1 for s in scores if s >= 4) * 100 / len(scores), 1) if scores else 0,
        },
        "key_findings": key_findings,
        "score_gaps": gaps,
        "model": ml,
        "recommendations": _recommendations(db, gaps),
    }
