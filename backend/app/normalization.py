"""Normalization layer: maps the trilingual (English/Sinhala/Tamil) Google Form
export into canonical English values and stable field names.

Form answer options look like "Female / ස්ත්‍රී / பெண்" or
"G.C.E. A/L | උසස් පෙළ | க.பொ.த உயர் தரம்" — the English part always comes
first, separated by '|' (preferred) or ' / '.
"""

from __future__ import annotations

import re
from datetime import datetime

# --- Column identification -------------------------------------------------
# Google Form headers are long and trilingual; identify each by its stable
# English prefix.
HEADER_PREFIXES: dict[str, str] = {
    "Timestamp": "timestamp",
    "Score": "score",
    "Select your district": "district",
    "Enter your age": "age",
    "Gender": "gender",
    "What is your current status": "current_status",
    "Select your highest completed educational qualification": "education_level",
    "Rate your English language proficiency": "english_proficiency",
    "What is the highest educational qualification of your parents": "parents_education",
    "Do you have a dedicated and quiet space": "has_study_space",
    "Estimated Monthly Household Income": "income_bracket",
    "What is the primary device": "primary_device",
    "Rate the quality of the internet connection": "internet_quality",
    "On average, how many hours per day": "study_hours",
    "Rate your ability to use software tools": "software_literacy",
    "Distance to the nearest public library": "library_distance",
    "Do you have access to paid online learning": "paid_resources",
    "How often do you participate in workshops": "extracurricular",
    "Complete the pattern": "quiz_pattern",
    "If you travel 10 meters North": "quiz_direction",
    'All "A" are "B"': "quiz_logic",
    "If 3 machines": "quiz_machines",
    '"X" is the brother': "quiz_relation",
}

QUIZ_FIELDS = ["quiz_pattern", "quiz_direction", "quiz_logic", "quiz_machines", "quiz_relation"]

QUIZ_CORRECT_ANSWERS = {
    "quiz_pattern": "127",
    "quiz_direction": "East",
    "quiz_logic": 'Some "B" are "A"',
    "quiz_machines": "3 minutes",
    "quiz_relation": "Son",
}

# --- Canonical category orders (used by the API for ordered charts) ---------
EDUCATION_LEVELS = [
    "Below G.C.E. O/L",
    "G.C.E. O/L",
    "G.C.E. A/L",
    "Diploma / NVQ",
    "Bachelor's Degree",
    "Postgraduate (Masters/PhD)",
]

INCOME_BRACKETS = [
    "Below Rs. 50,000",
    "Rs. 50,000 - Rs. 100,000",
    "Rs. 100,000 - Rs. 200,000",
    "Above Rs. 200,000",
]

STUDY_HOURS = [
    "Less than 1 hour",
    "1 - 3 hours",
    "3 - 5 hours",
    "More than 5 hours",
]

LIBRARY_DISTANCES = [
    "Less than 2 km",
    "2 - 5 km",
    "5 - 10 km",
    "More than 10 km",
]

PARENTS_EDUCATION = [
    "Primary/Secondary School",
    "Higher Secondary (A/L)",
    "Tertiary (Diploma/Degree)",
]

PAID_RESOURCES = [
    "No access at all",
    "Limited access",
    "Yes, I have full access",
]

EXTRACURRICULAR = ["Never", "Occasionally", "Regularly"]

CATEGORY_ORDERS: dict[str, list[str]] = {
    "education_level": EDUCATION_LEVELS,
    "income_bracket": INCOME_BRACKETS,
    "study_hours": STUDY_HOURS,
    "library_distance": LIBRARY_DISTANCES,
    "parents_education": PARENTS_EDUCATION,
    "paid_resources": PAID_RESOURCES,
    "extracurricular": EXTRACURRICULAR,
}


def match_header(header: str) -> str | None:
    """Map a raw CSV header to its canonical field name."""
    h = " ".join(header.split())  # collapse newlines/extra whitespace
    for prefix, field in HEADER_PREFIXES.items():
        if h.startswith(prefix):
            return field
    return None


def canonical_value(value: str) -> str:
    """Extract the English part of a trilingual answer."""
    if value is None:
        return ""
    v = " ".join(str(value).split()).strip()
    if "|" in v:
        v = v.split("|")[0].strip()
    elif " / " in v:
        v = v.split(" / ")[0].strip()
    # Normalize typographic apostrophes ("Bachelor’s" -> "Bachelor's")
    return v.replace("’", "'").strip()


def _parse_int(value, lo: int, hi: int) -> int | None:
    try:
        n = int(str(value).strip())
        return n if lo <= n <= hi else None
    except (TypeError, ValueError):
        return None


def _parse_score(value: str) -> int | None:
    """Google Forms exports quiz scores as '3 / 5'."""
    m = re.match(r"\s*(\d+)\s*/\s*\d+", str(value or ""))
    return int(m.group(1)) if m else None


def _parse_timestamp(value: str) -> datetime | None:
    for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(str(value).strip(), fmt)
        except (TypeError, ValueError):
            continue
    return None


def normalize_row(raw_row: dict[str, str]) -> dict:
    """Convert one raw CSV row into normalized field values.

    Returns a dict with the SurveyResponse column names, plus 'raw' and
    'quiz_answers'.
    """
    fields: dict[str, str] = {}
    for header, value in raw_row.items():
        field = match_header(header)
        if field:
            fields[field] = value

    quiz_answers = {}
    for qf in QUIZ_FIELDS:
        ans = canonical_value(fields.get(qf, ""))
        quiz_answers[qf] = {
            "answer": ans,
            "correct": ans == QUIZ_CORRECT_ANSWERS[qf],
        }

    return {
        "submitted_at": _parse_timestamp(fields.get("timestamp")),
        "district": canonical_value(fields.get("district", "")) or None,
        "age": _parse_int(fields.get("age"), 5, 100),
        "gender": canonical_value(fields.get("gender", "")) or None,
        "current_status": canonical_value(fields.get("current_status", "")) or None,
        "education_level": canonical_value(fields.get("education_level", "")) or None,
        "english_proficiency": _parse_int(fields.get("english_proficiency"), 1, 5),
        "parents_education": canonical_value(fields.get("parents_education", "")) or None,
        "has_study_space": canonical_value(fields.get("has_study_space", "")) == "Yes"
        if fields.get("has_study_space")
        else None,
        "income_bracket": canonical_value(fields.get("income_bracket", "")) or None,
        "primary_device": canonical_value(fields.get("primary_device", "")) or None,
        "internet_quality": _parse_int(fields.get("internet_quality"), 1, 5),
        "study_hours": canonical_value(fields.get("study_hours", "")) or None,
        "software_literacy": _parse_int(fields.get("software_literacy"), 1, 5),
        "library_distance": canonical_value(fields.get("library_distance", "")) or None,
        "paid_resources": canonical_value(fields.get("paid_resources", "")) or None,
        "extracurricular": canonical_value(fields.get("extracurricular", "")) or None,
        "score": _parse_score(fields.get("score")),
        "quiz_answers": quiz_answers,
        "raw": dict(raw_row),
    }
