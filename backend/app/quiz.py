"""'Try Questions' feature: serves the same 5 aptitude questions used in the
survey and scores a visitor's answers against the dataset."""

from __future__ import annotations

from sqlalchemy.orm import Session

from .models import SurveyResponse

QUESTIONS = [
    {
        "id": "quiz_pattern",
        "question": "Complete the pattern: 7, 15, 31, 63, ___?",
        "options": ["95", "121", "126", "127"],
        "answer": "127",
    },
    {
        "id": "quiz_direction",
        "question": (
            "If you travel 10 meters North, turn Right and travel 5 meters, "
            "then turn Right again and travel 10 meters, in which direction are "
            "you now relative to your starting point?"
        ),
        "options": ["North", "South", "East", "West"],
        "answer": "East",
    },
    {
        "id": "quiz_logic",
        "question": 'All "A" are "B". Some "B" are "C". Which of the following statements must be true?',
        "options": ['All "A" are "C"', 'Some "A" are "C"', 'Some "B" are "A"', 'No "C" is "B"'],
        "answer": 'Some "B" are "A"',
    },
    {
        "id": "quiz_machines",
        "question": "If 3 machines take 3 minutes to produce 3 items, how long will it take 100 machines to produce 100 items?",
        "options": ["1 minute", "3 minutes", "50 minutes", "100 minutes"],
        "answer": "3 minutes",
    },
    {
        "id": "quiz_relation",
        "question": '"X" is the brother of "Y". "Y" is the sister of "Z". If "W" is the father of "Z", what is the relationship between "X" and "W"?',
        "options": ["Father", "Son", "Brother", "Uncle"],
        "answer": "Son",
    },
]


def public_questions() -> list[dict]:
    return [{k: q[k] for k in ("id", "question", "options")} for q in QUESTIONS]


def grade(db: Session, answers: dict[str, str]) -> dict:
    results = []
    score = 0
    for q in QUESTIONS:
        given = (answers.get(q["id"]) or "").strip()
        correct = given == q["answer"]
        score += int(correct)
        results.append({"id": q["id"], "your_answer": given, "correct_answer": q["answer"], "correct": correct})

    dataset_scores = [r.score for r in db.query(SurveyResponse).all() if r.score is not None]
    beaten = sum(1 for s in dataset_scores if s < score)
    return {
        "score": score,
        "out_of": len(QUESTIONS),
        "results": results,
        "dataset_average": round(sum(dataset_scores) / len(dataset_scores), 2) if dataset_scores else None,
        "percentile": round(beaten * 100 / len(dataset_scores), 1) if dataset_scores else None,
    }
