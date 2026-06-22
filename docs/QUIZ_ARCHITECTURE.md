# MoodQue Quiz Architecture

Last checked: 2026-06-22

## Current State

`que_story` already contains the first quiz layer:

- `configs/question_bank.yaml` has a reusable faction-aligned question bank.
- `configs/quiz_tiers.yaml` defines `field_scan`, `faction_alignment`, and `twelve_gates`, though `field_scan` currently says 5 questions and older CTA language still points to Discord faction claiming.
- `scripts/build_quiz_variants.py` packages YAML questions into dated JSON variants under `quiz/generated/YYYY-MM-DD/`.
- `scripts/build_carousel.py` renders those variant JSON files into square carousel PNGs.
- `scripts/score_quiz.py` scores selected answers into factions and can persist quiz sessions in local SQLite.
- `territory/index.html` uses Firebase for the Territory Hunt phrase capture, not quiz assignment capture.

`que_engine` currently owns the Daily Launch quiz text:

- `forecast/quiz_engine.py` builds the daily social Field Scan slides and TikTok caption.
- `daily_launch.py` calls that generator on quiz days and writes the fields into the Daily Launch DB/CSV.
- As of this update, `forecast/quiz_engine.py` also builds the shared `field_scan_daily` JSON schema and writes it to `que_story/output/quiz/field_scan_daily.json` plus a dated archive.

## Missing Or Incomplete

- No production 12-question GitHub Pages faction quiz exists yet.
- No browser-side saved answer flow exists for the full quiz.
- No Firebase/Discord role assignment capture exists for quiz results in `que_story`.
- The older `quiz/generated/2026-06-05` field scans are 5-question social variants, not the current 3-question-max Daily Launch Field Scan model.
- `faction_alignment` is configured as 8 questions; the product decision now reserves official assignment for at least 12 questions.

## Product Rule

Social Field Scan:

- Maximum 3 questions.
- Temporary reading only.
- Used by Daily Launch carousel, social captions, and short-form engagement.
- Must never claim permanent faction assignment.

Full Territory/Faction Quiz:

- At least 12 questions.
- Official faction assignment only after completion.
- Should save quiz version, answers, scores, faction, timestamp, lunar phase, and territory state.
- Future Firebase/Discord capture should attach identity and role state here, not to the social Field Scan.

## Shared Field Scan Schema

The current static Pages data file is:

```text
output/quiz/field_scan_daily.json
```

It is generated with:

```powershell
python scripts/build_daily_field_scan.py --date 2026-06-22 --territory "The Wandering" --quadrant "The Wandering" --lunar-phase first_quarter --dominant-signal business --variant C
```

The static page at `territory-scan.html` reads that JSON and renders the daily Field Scan in the Daily Launch carousel style.
