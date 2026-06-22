# Monthly Assignment Quiz

The monthly quiz is the official identity layer.

It should assign:

- `primary_faction`: quadrant identity used for Discord roles.
- `primary_territory`: MoodQue territory placement.
- `nearest_vac_territory`: territory closest to the computed personal VAC.
- `personal_vac`: viewer-specific Valence, Arousal, Control vector.
- `playlist_seed`: normalized target values for Spotify and MoodQue Social playlist generation.

## Capture Direction

Use Firebase Realtime Database first because GitHub Pages is static and already has a browser Firebase config.

Write path:

```text
quiz_assignments/{source_month}/{push_id}
```

Discord is the second hop:

- user completes quiz on GitHub Pages
- Firebase stores assignment
- Discord bot can later claim/link a result by handle, push ID, or one-time code
- bot assigns the faction role from `configs/factions.yaml`

## Result Shape

```json
{
  "quiz_id": "monthly_assignment",
  "quiz_version": "2026.06",
  "source_month": "2026-06",
  "primary_faction": "calm",
  "primary_territory": "the_calm",
  "personal_vac": {
    "valence": 0.42,
    "arousal": -0.31,
    "control": 0.52
  },
  "playlist_seed": {
    "target_valence": 0.71,
    "target_energy": 0.35,
    "target_control": 0.76
  }
}
```

## Next Generator Layer

The current page consumes `output/quiz/monthly_assignment_current.json`.

The topic-pool builder should populate that file from prior-month:

- attention surface stories
- creator/VOD engagement
- comment sentiment
- community/category signals
- MoodQue content engagement

News/politics should be capped so the quiz measures broad attention, not only crisis attention.
