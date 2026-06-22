"""
Build a 36-question Monthly Territory Assignment quiz.

This first version emits the stable schema and balanced scoring surface.
The next layer should replace TOPICS with a prior-month topic pool built from
ASI, creator engagement, comment sentiment, community signals, and MoodQue
content performance.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "output" / "quiz"

FACTION_OPTIONS = {
    "current": {
        "label": "Move toward it. Use the energy before it cools.",
        "faction": "current",
        "vac": {"v": 0.70, "a": 0.70, "c": 0.45},
    },
    "static": {
        "label": "Hold position. Let the pressure reveal what matters.",
        "faction": "static",
        "vac": {"v": -0.45, "a": 0.65, "c": -0.15},
    },
    "hollow": {
        "label": "Step back. Let the feeling pass through without forcing it.",
        "faction": "hollow",
        "vac": {"v": -0.55, "a": -0.55, "c": -0.45},
    },
    "calm": {
        "label": "Find the quiet structure. Choose the clean next step.",
        "faction": "calm",
        "vac": {"v": 0.50, "a": -0.45, "c": 0.60},
    },
}

CENTROID_TO_TERRITORY = {
    "calm": "the_calm",
    "focus": "the_focus",
    "intensity": "the_current",
    "tension": "the_pressure",
    "social": "the_gathering",
    "introspection": "the_drift",
    "optimism": "the_radiance",
    "melancholy": "the_weight",
    "fatigue": "the_hollow",
    "playfulness": "the_gathering",
    "aggression": "the_raw",
    "serenity": "the_ethereal",
}

TOPICS = [
    ("calm_lofi", "calm", "creation", "Lofi and ambient music kept showing up as a place people used to steady themselves."),
    ("focus_science", "focus", "studies", "Science and long-form learning drew sustained attention."),
    ("sports_motion", "intensity", "physical_activity", "Sports highlights and movement-heavy content spiked engagement."),
    ("market_pressure", "tension", "business", "Markets, work, and money pressure stayed visible across attention surfaces."),
    ("relationship_language", "social", "communication", "Relationship and communication advice pulled people into conversation."),
    ("mental_health", "introspection", "personal_relationships", "Mental health content carried a quieter but persistent signal."),
    ("creator_optimism", "optimism", "dreams", "Entrepreneurship and self-improvement content pushed possibility and ambition."),
    ("sad_music", "melancholy", "dreams", "Sad music and emotional edits held a reflective lane."),
    ("sleep_rest", "fatigue", "dreams", "Sleep, ASMR, and recovery content showed a need for lower stimulation."),
    ("play_culture", "playfulness", "creation", "Entertainment and creator culture gave the month a lighter social outlet."),
    ("debate_conflict", "aggression", "disputes", "Debate and confrontation content concentrated heat and stance-taking."),
    ("spiritual_grounding", "serenity", "personal_relationships", "Spirituality, nature, and meditation content offered grounding."),
]

PROMPT_FRAMES = [
    "When this shows up in your feed, what is your honest first response?",
    "If this became the mood of your day, how would you move with it?",
    "What would you need from music after absorbing this kind of signal?",
]


def build_option(base_key: str, topic_id: str, domain: str, centroid: str, index: int) -> dict:
    base = FACTION_OPTIONS[base_key]
    return {
        "id": f"{base_key}_{index}",
        "label": base["label"],
        "faction": base["faction"],
        "territory": CENTROID_TO_TERRITORY.get(centroid, "the_wandering"),
        "domains": [domain],
        "vac": base["vac"],
        "weight": 1,
        "source_topic_id": topic_id,
    }


def build_quiz(source_month: str) -> dict:
    questions = []
    qnum = 1
    for topic_id, centroid, domain, topic_summary in TOPICS:
        for frame_index, frame in enumerate(PROMPT_FRAMES, start=1):
            questions.append({
                "id": f"q{qnum:02d}_{topic_id}_{frame_index}",
                "source_topic_id": topic_id,
                "category": domain,
                "centroid": centroid,
                "topic_summary": topic_summary,
                "prompt": f"{topic_summary} {frame}",
                "options": [
                    build_option("current", topic_id, domain, centroid, qnum),
                    build_option("static", topic_id, domain, centroid, qnum),
                    build_option("hollow", topic_id, domain, centroid, qnum),
                    build_option("calm", topic_id, domain, centroid, qnum),
                ],
            })
            qnum += 1

    return {
        "quiz_id": "monthly_assignment",
        "quiz_version": source_month.replace("-", "."),
        "quiz_type": "monthly_assignment",
        "source_month": source_month,
        "question_count": len(questions),
        "official_assignment": True,
        "captures_personal_vac": True,
        "capture_target": "firebase_realtime_db",
        "firebase_path": f"quiz_assignments/{source_month}",
        "discord_role_claim": "second_hop",
        "questions": questions,
    }


def write_quiz(quiz: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(quiz, indent=2, ensure_ascii=False) + "\n"
    dated = OUT_DIR / f"monthly_assignment_{quiz['source_month']}.json"
    current = OUT_DIR / "monthly_assignment_current.json"
    dated.write_text(payload, encoding="utf-8")
    current.write_text(payload, encoding="utf-8")
    print(f"Wrote {current}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the monthly assignment quiz JSON.")
    parser.add_argument("--source-month", required=True, help="YYYY-MM")
    args = parser.parse_args()
    write_quiz(build_quiz(args.source_month))


if __name__ == "__main__":
    main()
