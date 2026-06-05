"""
build_carousel.py — Generate Instagram carousel PNGs from a quiz variant JSON.

Que character pose (RGBA, transparent bg) is composited on the right side of
each slide. Text occupies the left zone. Space Mono Bold/Regular is used for
all type.

Output: quiz/generated/YYYY-MM-DD/carousel/{variant_id}/
    slide_00_intro.png
    slide_01_q1.png ... slide_0N_qN.png
    slide_last_result.png

Usage:
    python scripts/build_carousel.py --variant quiz/generated/2026-06-05/field_scan_20260605_A.json
    python scripts/build_carousel.py --variant ... --accent calm

Requirements:
    pip install Pillow
    fonts/SpaceMono-Bold.ttf + fonts/SpaceMono-Regular.ttf
    assets/poses/que_calm.png, que_elevated.png, que_engaged.png
"""

import json
import os
import textwrap
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit("Pillow required: pip install Pillow")

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT      = Path(__file__).parent.parent
FONT_DIR  = ROOT / "fonts"
ASSET_DIR = ROOT / "assets" / "poses"

# ── Brand colors ──────────────────────────────────────────────────────────────

COLORS = {
    "bg":        (13,  13,  13),
    "white":     (255, 255, 255),
    "muted":     (100, 100, 100),
    "dim":       (50,  50,  50),
    "current":   (20,  230, 243),   # #14E6F3
    "static":    (165, 83,  165),   # #A553A5
    "hollow":    (125, 97,  158),   # #7D619E
    "calm":      (236, 163, 94),    # #ECA35E
    "wandering": (60,  60,  60),
}

FACTION_COLORS = {
    "current":   COLORS["current"],
    "static":    COLORS["static"],
    "hollow":    COLORS["hollow"],
    "calm":      COLORS["calm"],
    "wandering": COLORS["wandering"],
}

FACTION_LABELS = {
    "current": "THE CURRENT",
    "static":  "THE STATIC",
    "hollow":  "THE HOLLOW",
    "calm":    "THE CALM",
}

FACTION_DESC = {
    "current": "You move through things.",
    "static":  "You feel everything first.",
    "hollow":  "You go quiet to survive.",
    "calm":    "You hold it together.",
}

# Which Que pose to use per slide type
POSE_MAP = {
    "intro":    "que_elevated.png",
    "question": "que_engaged.png",
    "result":   "que_calm.png",
}

SLIDE_W, SLIDE_H = 1080, 1080

# Text stays in the left zone; character occupies the right
TEXT_MAX_X  = 480   # hard right edge for text content
QUE_TARGET_H = 960  # Que character scaled to this height (slightly taller than slide for bleed)


# ── Font loading ──────────────────────────────────────────────────────────────

def load_fonts():
    """Load Space Mono at all needed sizes, fall back to PIL default."""
    try:
        bold    = FONT_DIR / "SpaceMono-Bold.ttf"
        regular = FONT_DIR / "SpaceMono-Regular.ttf"
        if not bold.exists() or not regular.exists():
            raise FileNotFoundError("Space Mono fonts not found in fonts/")
        return {
            "display":  ImageFont.truetype(str(bold),    52),
            "heading":  ImageFont.truetype(str(bold),    36),
            "question": ImageFont.truetype(str(bold),    30),
            "body":     ImageFont.truetype(str(regular), 22),
            "label":    ImageFont.truetype(str(bold),    17),
            "micro":    ImageFont.truetype(str(regular), 15),
        }
    except (FileNotFoundError, OSError) as e:
        print(f"Warning: {e} — using system default font.")
        d = ImageFont.load_default()
        return {k: d for k in ("display", "heading", "question", "body", "label", "micro")}


# ── Que character compositing ─────────────────────────────────────────────────

def _load_que_pose(pose_key: str):
    """Load and scale a Que pose PNG. Returns None if file missing."""
    path = ASSET_DIR / POSE_MAP.get(pose_key, "que_engaged.png")
    if not path.exists():
        print(f"Warning: pose not found at {path}")
        return None
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    scale_w = int(QUE_TARGET_H * w / h)
    return img.resize((scale_w, QUE_TARGET_H), Image.LANCZOS)


def composite_que(base_rgb: Image.Image, pose_key: str) -> Image.Image:
    """Paste a Que pose onto the right side of the slide, bottom-anchored with bleed."""
    que = _load_que_pose(pose_key)
    if que is None:
        return base_rgb

    base_rgba = base_rgb.convert("RGBA")

    # Right-anchored: allow 40px bleed off the right edge
    # Bottom-anchored: allow 80px bleed off the bottom edge
    x = SLIDE_W - que.width + 40
    y = SLIDE_H - QUE_TARGET_H + 80

    base_rgba.paste(que, (x, y), que)
    return base_rgba.convert("RGB")


# ── Shared drawing utilities ──────────────────────────────────────────────────

def accent_bar(draw, color, height=16):
    """Full-width faction-colored bar at the top."""
    draw.rectangle([(0, 0), (SLIDE_W, height)], fill=color)


def watermark(draw, fonts):
    """moodQue brand mark at bottom left."""
    draw.text((60, SLIDE_H - 44), "moodQue  |  enter the field",
              fill=COLORS["muted"], font=fonts["micro"])


def slide_counter(draw, n, total, fonts, color):
    """Slide N/total in top-right corner."""
    draw.text((SLIDE_W - 54, 30), f"{n}/{total}",
              fill=color, font=fonts["label"], anchor="ra")


def divider(draw, x, y, width, color):
    """Thin 2px horizontal rule."""
    draw.rectangle([(x, y), (x + width, y + 2)], fill=color)


def wrapped_lines(text: str, max_chars: int) -> list:
    """Wrap text to a max char width."""
    return textwrap.wrap(text, width=max_chars)


# ── Slide builders ────────────────────────────────────────────────────────────

def make_intro_slide(tier_name: str, fonts: dict) -> Image.Image:
    """Slide 0 — teases the quiz and instructs the viewer to swipe."""
    img  = Image.new("RGB", (SLIDE_W, SLIDE_H), COLORS["bg"])
    img  = composite_que(img, "intro")
    draw = ImageDraw.Draw(img)

    accent_bar(draw, COLORS["current"])

    # Brand label
    draw.text((60, 38),  "MOODQUE",    fill=COLORS["current"], font=fonts["label"])
    draw.text((60, 62),  "FIELD SCAN", fill=COLORS["muted"],   font=fonts["label"])

    # Main tier name
    draw.text((60, 118), tier_name.upper(), fill=COLORS["white"], font=fonts["display"])

    divider(draw, 60, 192, 220, COLORS["current"])

    # Copy block
    y = 216
    for text, color in [
        ("Four signals.",     COLORS["muted"]),
        ("One is yours.",     COLORS["white"]),
        ("",                  None),
        ("Answer honestly.",  COLORS["white"]),
        ("No right answer.",  COLORS["muted"]),
        ("This is instinct.", COLORS["muted"]),
    ]:
        if text:
            draw.text((60, y), text, fill=color, font=fonts["body"])
        y += 38

    # CTA
    draw.text((60, SLIDE_H - 110), "SWIPE TO BEGIN", fill=COLORS["current"], font=fonts["label"])
    draw.text((60, SLIDE_H - 88),  "->",             fill=COLORS["current"], font=fonts["label"])

    watermark(draw, fonts)
    return img


def make_question_slide(n: int, total: int, question: dict,
                        accent: tuple, fonts: dict) -> Image.Image:
    """One question slide — question text and four labeled answers."""
    img  = Image.new("RGB", (SLIDE_W, SLIDE_H), COLORS["bg"])
    img  = composite_que(img, "question")
    draw = ImageDraw.Draw(img)

    accent_bar(draw, accent)
    slide_counter(draw, n, total, fonts, accent)

    # Section label
    draw.text((60, 34), f"QUESTION {n - 1}", fill=accent, font=fonts["label"])

    # Question text — wrap to keep left of the character
    q_lines = wrapped_lines(question.get("question", ""), max_chars=20)
    y = 100
    for line in q_lines:
        draw.text((60, y), line, fill=COLORS["white"], font=fonts["question"])
        y += 46

    divider(draw, 60, y + 8, 180, accent)
    y += 28

    # Answer options — label letter colored by faction, text in muted
    for answer in question.get("answers", []):
        lbl        = answer.get("label", "")
        text       = answer.get("text", "")
        faction_id = answer.get("faction_id", "current")
        f_color    = FACTION_COLORS.get(faction_id, COLORS["muted"])

        # Letter in faction color
        draw.text((60, y), f"{lbl}.", fill=f_color, font=fonts["body"])

        # Answer text, indented, wrapped to stay left of character
        a_lines = wrapped_lines(text, max_chars=24)
        for i, line in enumerate(a_lines):
            draw.text((96, y + i * 30), line, fill=COLORS["muted"], font=fonts["body"])

        y += len(a_lines) * 30 + 18

    watermark(draw, fonts)
    return img


def make_result_slide(fonts: dict) -> Image.Image:
    """Final slide — prompts user to comment answers and lists factions."""
    img  = Image.new("RGB", (SLIDE_W, SLIDE_H), COLORS["bg"])
    img  = composite_que(img, "result")
    draw = ImageDraw.Draw(img)

    accent_bar(draw, COLORS["static"])

    draw.text((60, 36), "WHICH SIGNAL", fill=COLORS["white"], font=fonts["heading"])
    draw.text((60, 82), "ARE YOU?",     fill=COLORS["white"], font=fonts["heading"])

    divider(draw, 60, 136, 280, COLORS["static"])

    draw.text((60, 156), "Comment your answers below.",  fill=COLORS["muted"],   font=fonts["body"])
    draw.text((60, 190), "A  B  C  D",                   fill=COLORS["current"], font=fonts["heading"])

    # Faction list
    y = 290
    for key, label in FACTION_LABELS.items():
        color = FACTION_COLORS[key]
        draw.text((60, y),      f"[ {label} ]",      fill=color,         font=fonts["label"])
        draw.text((60, y + 24), FACTION_DESC[key],   fill=COLORS["muted"], font=fonts["micro"])
        y += 68

    # Discord CTA
    y += 10
    draw.text((60, y),      "Claim your faction ->", fill=COLORS["muted"],   font=fonts["label"])
    draw.text((60, y + 28), "discord.gg/moodque",    fill=COLORS["current"], font=fonts["label"])

    watermark(draw, fonts)
    return img


# ── Main build function ───────────────────────────────────────────────────────

def build_carousel(variant_path: str, accent_faction: str = "current") -> list:
    """Build all slides for a quiz variant and save PNGs to carousel/ subdirectory."""
    variant_path = Path(variant_path)
    with open(variant_path, encoding="utf-8") as f:
        variant = json.load(f)

    questions  = variant.get("questions", [])
    variant_id = variant.get("variant_id", "A")
    tier_name  = variant.get("tier", "Field Scan").replace("_", " ").title()
    accent     = FACTION_COLORS.get(accent_faction, COLORS["current"])

    fonts   = load_fonts()
    out_dir = variant_path.parent / "carousel" / variant_id
    os.makedirs(out_dir, exist_ok=True)

    total = len(questions) + 2   # intro + N questions + result
    saved = []

    # Slide 0 — intro
    intro = make_intro_slide(tier_name, fonts)
    p = out_dir / "slide_00_intro.png"
    intro.save(p)
    saved.append(p)
    print(f"  slide_00_intro.png")

    # Question slides
    for i, q in enumerate(questions):
        slide = make_question_slide(i + 2, total, q, accent, fonts)
        fname = f"slide_{str(i + 1).zfill(2)}_q{i + 1}.png"
        p     = out_dir / fname
        slide.save(p)
        saved.append(p)
        print(f"  {fname}")

    # Result slide
    result = make_result_slide(fonts)
    fname  = f"slide_{str(total).zfill(2)}_result.png"
    p      = out_dir / fname
    result.save(p)
    saved.append(p)
    print(f"  {fname}")

    print(f"\n{len(saved)} slides -> {out_dir}")
    return saved


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build carousel PNGs from a quiz variant JSON.")
    parser.add_argument("--variant", required=True,
                        help="Path to variant JSON")
    parser.add_argument("--accent", default="current",
                        help="Faction accent color: current | static | hollow | calm")
    args = parser.parse_args()
    build_carousel(args.variant, args.accent)
