"""
Build the static Daily Field Scan JSON used by the GitHub Pages quiz.

The output shape is intentionally shared with Daily Launch:
field scans are temporary readings, while full faction assignment remains
reserved for the 12-question Territory Scan.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "output" / "quiz"
ARCHIVE_DIR = OUT_DIR / "archive"

FULL_SCAN_URL = "https://moodque.github.io/que_story/territory-scan.html"

VARIANTS = {
    "A": {
        "prompt": "When the noise finally stops, what's left in the room?",
        "options": [
            ("⚡", "A charge that won't sit still", "storm_lands", "The Storm"),
            ("🌧", "A weight you're still carrying", "hollow_grounds", "The Hollow"),
            ("🌙", "A quiet that feels complete", "still_places", "The Ethereal"),
            ("🌕", "A pull toward other people", "lit_realms", "The Gathering"),
        ],
    },
    "B": {
        "prompt": "Right now, what's pulling on you the hardest?",
        "options": [
            ("🌕", "Toward connection, motion, light", "lit_realms", "The Gathering"),
            ("⚡", "Toward something unresolved", "storm_lands", "The Storm"),
            ("🌧", "Toward what's missing", "hollow_grounds", "The Hollow"),
            ("🌙", "Toward stillness, away from it all", "still_places", "The Ethereal"),
        ],
    },
    "C": {
        "prompt": "If your inner state had weather today, what's the forecast?",
        "options": [
            ("🌕", "Bright, open, moving", "lit_realms", "The Gathering"),
            ("⚡", "Pressure building, no release", "storm_lands", "The Storm"),
            ("🌧", "Low, grey, and slow", "hollow_grounds", "The Hollow"),
            ("🌙", "Clear and still", "still_places", "The Ethereal"),
        ],
    },
    "D": {
        "prompt": "Not where you are. Where are you drifting?",
        "options": [
            ("🌕", "Up, toward people and light", "lit_realms", "The Gathering"),
            ("⚡", "Sideways, charged and stuck", "storm_lands", "The Storm"),
            ("🌧", "Down, into the quiet ache", "hollow_grounds", "The Hollow"),
            ("🌙", "Inward, toward focus", "still_places", "The Ethereal"),
        ],
    },
}

FIELD_READINGS = {
    "storm_lands": "Your Field Scan reads like Storm Lands energy today.",
    "hollow_grounds": "Your Field Scan reads like Hollow Grounds energy today.",
    "still_places": "Your Field Scan reads like Still Places energy today.",
    "lit_realms": "Your Field Scan reads like Lit Realms energy today.",
}


def build_daily_field_scan(
    launch_date: date,
    territory: str,
    quadrant: str,
    lunar_phase: str,
    dominant_signal: str,
    variant: str,
) -> dict:
    variant = (variant or "C").upper()
    selected = VARIANTS.get(variant, VARIANTS["C"])
    questions = [
        {
            "id": "q1",
            "prompt": selected["prompt"],
            "options": [
                {
                    "label": label,
                    "symbol": symbol,
                    "score_key": score_key,
                    "reading": reading,
                }
                for symbol, label, score_key, reading in selected["options"]
            ],
        }
    ]

    return {
        "quiz_id": "field_scan_daily",
        "quiz_version": launch_date.strftime("%Y.%m.%d"),
        "quiz_type": "field_scan",
        "date": launch_date.isoformat(),
        "territory": territory,
        "quadrant": quadrant,
        "lunar_phase": lunar_phase,
        "dominant_signal": dominant_signal,
        "question_count": len(questions),
        "variant": variant,
        "result_mode": "temporary_reading",
        "official_assignment": False,
        "full_quiz_url": FULL_SCAN_URL,
        "cta": "Take the full 12-question Territory Scan to confirm your faction.",
        "questions": questions,
        "field_readings": FIELD_READINGS,
        "disclaimer": "This is a daily scan, not your confirmed faction.",
    }


def write_scan(scan: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

    current_path = OUT_DIR / "field_scan_daily.json"
    archive_path = ARCHIVE_DIR / f"field_scan_{scan['date']}.json"
    payload = json.dumps(scan, indent=2, ensure_ascii=False) + "\n"

    current_path.write_text(payload, encoding="utf-8")
    archive_path.write_text(payload, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the GitHub Pages Daily Field Scan JSON.")
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--territory", default="The Wandering")
    parser.add_argument("--quadrant", default="The Wandering")
    parser.add_argument("--lunar-phase", default="")
    parser.add_argument("--dominant-signal", default="unknown")
    parser.add_argument("--variant", default="C", choices=sorted(VARIANTS))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    scan = build_daily_field_scan(
        launch_date=date.fromisoformat(args.date),
        territory=args.territory,
        quadrant=args.quadrant,
        lunar_phase=args.lunar_phase,
        dominant_signal=args.dominant_signal,
        variant=args.variant,
    )
    write_scan(scan)
    print(f"Wrote {OUT_DIR / 'field_scan_daily.json'}")


if __name__ == "__main__":
    main()
