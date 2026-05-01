#!/usr/bin/env python3
"""Generate QR PNGs for Que scene URLs listed in scenes/scenes.json.

Install dependency once:
  python -m pip install qrcode[pil]

Usage:
  python scripts/generate_qr_codes.py https://your-domain.example
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import qrcode
except ImportError as exc:
    raise SystemExit(
        "Missing dependency: install with `python -m pip install qrcode[pil]`"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
SCENES_FILE = ROOT / "scenes" / "scenes.json"
OUTPUT_ROOT = ROOT / "qr_codes"


def main() -> None:
    base_url = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else ""
    scenes = json.loads(SCENES_FILE.read_text(encoding="utf-8"))

    for scene in scenes:
        week = scene["week"]
        centroid = scene["centroid"]
        path = scene["url"]
        url = f"{base_url}{path}" if base_url else path

        output_dir = OUTPUT_ROOT / week
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{centroid}.png"

        img = qrcode.make(url)
        img.save(output_file)
        print(f"{output_file.relative_to(ROOT)} -> {url}")


if __name__ == "__main__":
    main()
