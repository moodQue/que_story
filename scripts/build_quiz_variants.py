"""
build_quiz_variants.py — Package question bank into quiz variant JSON files.

Reads question_bank.yaml, selects questions for the requested tier,
and outputs N variant JSON packages with non-overlapping question sets.

Usage:
    python scripts/build_quiz_variants.py --tier field_scan --campaign field_scan_20260605 --variants 4
    python scripts/build_quiz_variants.py --tier faction_alignment --campaign alignment_20260605 --variants 2

Output:
    quiz/generated/YYYY-MM-DD/{campaign}_{variant_letter}.json
"""

import argparse
import json
import os
import random
import yaml
from datetime import datetime
from pathlib import Path

BASE_DIR    = Path(__file__).parent.parent
CONFIG_DIR  = BASE_DIR / "configs"
OUTPUT_BASE = BASE_DIR / "quiz" / "generated"


def load_yaml(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def build_variants(tier: str, campaign: str, n_variants: int, seed: int | None = None):
    bank_data  = load_yaml(CONFIG_DIR / "question_bank.yaml")
    tiers_data = load_yaml(CONFIG_DIR / "quiz_tiers.yaml")

    tier_cfg = tiers_data["tiers"].get(tier)
    if not tier_cfg:
        raise ValueError(f"Unknown tier '{tier}'. Available: {list(tiers_data['tiers'].keys())}")

    q_count  = tier_cfg["question_count"]
    all_qs   = bank_data.get("questions", [])

    if len(all_qs) < q_count * n_variants:
        print(f"⚠️  Bank has {len(all_qs)} questions but {q_count * n_variants} needed "
              f"for {n_variants} non-overlapping variants of {q_count} questions each.")
        print(f"   Variants will share some questions. Run generate_faction_questions.py to expand the bank.")

    today_str  = datetime.now().strftime("%Y-%m-%d")
    out_dir    = OUTPUT_BASE / today_str
    os.makedirs(out_dir, exist_ok=True)

    rng = random.Random(seed or int(datetime.now().timestamp()))

    # Shuffle the full bank once, then slice into variant pools
    pool = all_qs.copy()
    rng.shuffle(pool)

    variant_letters = list("ABCDEFGHIJ")[:n_variants]
    created = []

    for i, letter in enumerate(variant_letters):
        # Slice a chunk for this variant, wrapping if we run out
        start = (i * q_count) % len(pool)
        if start + q_count <= len(pool):
            variant_qs = pool[start:start + q_count]
        else:
            # Wrap around
            variant_qs = pool[start:] + pool[:q_count - (len(pool) - start)]

        # Shuffle answer order within each question so A isn't always the same faction
        shuffled_qs = []
        for q in variant_qs:
            q_copy = dict(q)
            answers = list(q_copy["answers"])
            rng.shuffle(answers)
            # Re-label A/B/C/D after shuffle
            labels = ["A", "B", "C", "D"]
            for j, ans in enumerate(answers):
                ans["label"] = labels[j]
            q_copy["answers"] = answers
            shuffled_qs.append(q_copy)

        variant_id  = f"{campaign}_{letter}"
        output_path = out_dir / f"{variant_id}.json"

        package = {
            "variant_id":    variant_id,
            "tier":          tier,
            "campaign_id":   campaign,
            "created_at":    datetime.now().isoformat(),
            "question_count": q_count,
            "cta":           tier_cfg["cta"],
            "platforms":     tier_cfg["platforms"],
            "questions":     shuffled_qs,
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(package, f, indent=2, ensure_ascii=False)

        created.append(output_path)
        print(f"  ✓ {output_path.name}  ({q_count} questions)")

    print(f"\n✅ {n_variants} variant(s) written to: {out_dir}")
    return created


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build quiz variant JSON packages.")
    parser.add_argument("--tier",     required=True, help="field_scan | faction_alignment | twelve_gates")
    parser.add_argument("--campaign", required=True, help="e.g. field_scan_20260605")
    parser.add_argument("--variants", type=int, default=4, help="Number of A/B/C/D variants (default: 4)")
    parser.add_argument("--seed",     type=int, default=None, help="Random seed for reproducibility")
    args = parser.parse_args()

    build_variants(args.tier, args.campaign, args.variants, args.seed)
