"""
score_quiz.py — Core faction scoring engine.

Takes a list of quiz answers and returns a faction assignment.
Handles all tiebreaker logic. Saves results to SQLite.

Usage (test):
    python scripts/score_quiz.py
"""

import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DB_PATH  = BASE_DIR / "data" / "quiz_sessions.db"

FACTION_VALENCE = {"current": 1, "calm": 1, "static": 0, "hollow": 0, "wandering": 0.5}
FACTION_AROUSAL = {"current": 1, "static": 1, "calm": 0, "hollow": 0, "wandering": 0.5}

NAMED_TIE_WINNERS = {
    frozenset({"current", "calm"}):   "current",
    frozenset({"static", "hollow"}):  "static",
    frozenset({"current", "static"}): "current",
    frozenset({"hollow", "calm"}):    "calm",
}


def init_db():
    os.makedirs(DB_PATH.parent, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS quiz_sessions (
            session_id TEXT PRIMARY KEY, platform TEXT, variant_id TEXT,
            campaign_id TEXT, username TEXT, email TEXT,
            primary_faction TEXT, secondary_faction TEXT,
            tiebreaker_used INTEGER DEFAULT 0, tiebreaker_reason TEXT,
            scores_json TEXT, tier TEXT, lunar_phase TEXT,
            created_at TEXT, discord_joined INTEGER DEFAULT 0
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS quiz_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT,
            question_id TEXT, answer_label TEXT, faction_awarded TEXT,
            weight INTEGER, created_at TEXT,
            FOREIGN KEY (session_id) REFERENCES quiz_sessions(session_id)
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS retarget_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT,
            platform TEXT, username TEXT, email TEXT,
            primary_faction TEXT, quiz_tier TEXT, next_tier TEXT,
            retarget_sent INTEGER DEFAULT 0, created_at TEXT
        )
    """)
    conn.commit()
    conn.close()


def resolve_tie(tied_factions: list) -> tuple:
    pair_key = frozenset(tied_factions)
    if pair_key in NAMED_TIE_WINNERS:
        winner = NAMED_TIE_WINNERS[pair_key]
        return winner, f"Named pair: {' vs '.join(tied_factions)} → {winner}"
    by_arousal = sorted(tied_factions, key=lambda f: FACTION_AROUSAL.get(f, 0), reverse=True)
    top_a = FACTION_AROUSAL.get(by_arousal[0], 0)
    arousal_winners = [f for f in by_arousal if FACTION_AROUSAL.get(f, 0) == top_a]
    if len(arousal_winners) == 1:
        return arousal_winners[0], f"Arousal tiebreaker → {arousal_winners[0]}"
    by_valence = sorted(arousal_winners, key=lambda f: FACTION_VALENCE.get(f, 0), reverse=True)
    top_v = FACTION_VALENCE.get(by_valence[0], 0)
    valence_winners = [f for f in by_valence if FACTION_VALENCE.get(f, 0) == top_v]
    if len(valence_winners) == 1:
        return valence_winners[0], f"Valence tiebreaker → {valence_winners[0]}"
    return "wandering", f"Unresolvable tie between {tied_factions}"


def score_answers(answers: list) -> dict:
    scores = {"current": 0, "static": 0, "hollow": 0, "calm": 0, "wandering": 0}
    for answer in answers:
        faction = answer.get("faction_id")
        weight  = answer.get("weight", 1)
        if faction in scores:
            scores[faction] += weight
    ranked    = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_score = ranked[0][1]
    top_factions = [f for f, s in ranked if s == top_score and f != "wandering"]
    tiebreaker_used, tiebreaker_reason = False, None
    if len(top_factions) == 1:
        primary = top_factions[0]
    elif len(top_factions) >= 4:
        primary, tiebreaker_used, tiebreaker_reason = (
            "wandering", True, "4-way tie — signal ambiguity"
        )
    else:
        primary, tiebreaker_reason = resolve_tie(top_factions)
        tiebreaker_used = True
    secondary = next(
        (f for f, s in ranked if f != primary and f != "wandering" and s > 0), None
    )
    return {
        "scores": scores, "primary_faction": primary, "secondary_faction": secondary,
        "tiebreaker_used": tiebreaker_used, "tiebreaker_reason": tiebreaker_reason,
    }


def save_result(session_id: str, result: dict, answers: list, meta: dict):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    now  = datetime.utcnow().isoformat()
    c.execute("""
        INSERT OR REPLACE INTO quiz_sessions (
            session_id, platform, variant_id, campaign_id, username, email,
            primary_faction, secondary_faction, tiebreaker_used, tiebreaker_reason,
            scores_json, tier, lunar_phase, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        session_id, meta.get("platform"), meta.get("variant_id"), meta.get("campaign_id"),
        meta.get("username"), meta.get("email"),
        result["primary_faction"], result.get("secondary_faction"),
        int(result.get("tiebreaker_used", False)), result.get("tiebreaker_reason"),
        json.dumps(result["scores"]), meta.get("tier"), meta.get("lunar_phase"), now,
    ))
    for answer in answers:
        c.execute("""
            INSERT INTO quiz_answers (session_id, question_id, answer_label, faction_awarded, weight, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (session_id, answer.get("question_id"), answer.get("answer_label"),
              answer.get("faction_id"), answer.get("weight", 1), now))
    if meta.get("tier") == "field_scan" and (meta.get("email") or meta.get("username")):
        c.execute("""
            INSERT INTO retarget_queue (session_id, platform, username, email,
                primary_faction, quiz_tier, next_tier, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, meta.get("platform"), meta.get("username"), meta.get("email"),
              result["primary_faction"], "field_scan", "faction_alignment", now))
    conn.commit()
    conn.close()


if __name__ == "__main__":
    print("=== TEST 1: Clear winner (current) ===")
    r1 = score_answers([
        {"question_id": "g01", "answer_label": "A", "faction_id": "current", "weight": 2},
        {"question_id": "g02", "answer_label": "A", "faction_id": "current", "weight": 2},
        {"question_id": "g03", "answer_label": "B", "faction_id": "calm",    "weight": 2},
        {"question_id": "g04", "answer_label": "C", "faction_id": "static",  "weight": 1},
        {"question_id": "g05", "answer_label": "A", "faction_id": "current", "weight": 2},
    ])
    print(json.dumps(r1, indent=2))
    assert r1["primary_faction"] == "current" and not r1["tiebreaker_used"], "Test 1 failed"

    print("\n=== TEST 2: current vs calm tie -> current wins ===")
    r2 = score_answers([
        {"question_id": "g01", "answer_label": "A", "faction_id": "current", "weight": 2},
        {"question_id": "g02", "answer_label": "B", "faction_id": "calm",    "weight": 2},
        {"question_id": "g03", "answer_label": "A", "faction_id": "current", "weight": 1},
        {"question_id": "g04", "answer_label": "B", "faction_id": "calm",    "weight": 1},
    ])
    print(json.dumps(r2, indent=2))
    assert r2["primary_faction"] == "current" and r2["tiebreaker_used"], "Test 2 failed"

    print("\n=== TEST 3: 4-way tie → wandering ===")
    r3 = score_answers([
        {"question_id": "g01", "answer_label": "A", "faction_id": "current", "weight": 1},
        {"question_id": "g02", "answer_label": "B", "faction_id": "static",  "weight": 1},
        {"question_id": "g03", "answer_label": "C", "faction_id": "hollow",  "weight": 1},
        {"question_id": "g04", "answer_label": "D", "faction_id": "calm",    "weight": 1},
    ])
    print(json.dumps(r3, indent=2))
    assert r3["primary_faction"] == "wandering", "Test 3 failed"

    print("\n✅ All tests passed.")
