/**
 * story-loader.js — Que Story Engine Bridge
 *
 * Wires the que_engine Python story engine output to the site's
 * story pages via Google Sheets as the shared data store.
 *
 * HOW IT WORKS
 * ─────────────────────────────────────────────────────────────
 * 1. que_engine exports each generated issue to Google Sheets
 *    (columns: story_id, territory, episode_text, scene_note,
 *     image_url, timestamp, issue_title)
 * 2. Any story page can be linked with ?story=STORY_ID
 * 3. This script fetches that row and injects the live content
 * 4. Without ?story= param → static seed content shows as-is
 *
 * TERRITORY ID MAPPING (que_engine → site)
 * ─────────────────────────────────────────────────────────────
 * que_engine territory_id   →  site page
 * ──────────────────────────────────────────
 * ember / awakening         →  story/ember.html
 * pulse / momentum          →  story/pulse.html
 * lumen / clarity           →  story/lumen.html
 * haven / calm              →  story/haven.html
 * drift / reflection        →  story/drift.html
 * echo  / nostalgia         →  story/echo.html
 * flux  / chaos             →  story/flux.html
 * apex  / intensity         →  story/apex.html
 * nova  / inspiration       →  story/nova.html
 * veil  / mystery           →  story/veil.html
 * terra / grounding         →  story/terra.html
 * zenith / alignment        →  story/zenith.html
 *
 * REQUIRED GOOGLE SHEET COLUMNS
 * ─────────────────────────────────────────────────────────────
 * story_id     — unique ID  (e.g. QUE-042 or ember-20260429)
 * territory    — matches page data-territory attribute
 * episode_text — the ≤120-word story fragment (discord export)
 * scene_note   — optional atmospheric line shown below text
 * image_url    — optional centroid override image URL
 * issue_title  — optional override for the h1 eyebrow label
 * timestamp    — ISO 8601, shown as "Signal received" date
 */

(function () {
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/1do3Qbf_oCKeWT8cePoSib4XnodAbUs9t_QjiEUeFCbQ/gviz/tq?tqx=out:csv";

  const params   = new URLSearchParams(window.location.search);
  const storyId  = params.get("story");

  // No param → keep static seed content, do nothing
  if (!storyId) return;

  const territory = document.body.dataset.territory || "";

  async function load() {
    try {
      const res  = await fetch(SHEET_CSV_URL);
      const text = await res.text();
      const rows = parseCSV(text);

      const story = rows.find(r => r.story_id === storyId);

      if (!story) {
        appendSignalNote("Signal not found — showing seed content.");
        return;
      }

      // ── Inject episode text ──────────────────────────────
      const bodyEl = document.querySelector(".episode-body");
      if (bodyEl && story.episode_text) {
        bodyEl.textContent = story.episode_text;
      }

      // ── Inject scene note (optional) ─────────────────────
      if (story.scene_note) {
        const note = document.createElement("p");
        note.className = "scene-note";
        note.style.cssText =
          "font-size:13px;letter-spacing:2px;text-transform:uppercase;" +
          "color:var(--gold);margin-top:20px;opacity:.8;";
        note.textContent = story.scene_note;
        bodyEl && bodyEl.after(note);
      }

      // ── Override eyebrow with issue title (optional) ─────
      if (story.issue_title) {
        const ew = document.querySelector(".eyebrow");
        if (ew) ew.textContent = story.issue_title;
      }

      // ── Override background image (optional) ─────────────
      if (story.image_url) {
        const hero = document.querySelector(".hero");
        if (hero) {
          const current = hero.style.backgroundImage || "";
          const gradient = current.match(/linear-gradient\([^)]+\)/)?.[0] ||
            "linear-gradient(rgba(7,17,28,.25), rgba(7,17,28,.82))";
          hero.style.backgroundImage =
            `${gradient}, url('${story.image_url}')`;
        }
      }

      // ── Timestamp badge ───────────────────────────────────
      if (story.timestamp) {
        const ts = new Date(story.timestamp);
        if (!isNaN(ts)) {
          appendSignalNote(
            "Signal received: " +
            ts.toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          );
        }
      }

    } catch (err) {
      // Fail silently — static seed content remains visible
      console.warn("[story-loader] Could not fetch story signal:", err);
    }
  }

  function appendSignalNote(text) {
    const btns = document.querySelector(".btns");
    if (!btns) return;
    const badge = document.createElement("p");
    badge.style.cssText =
      "font-size:11px;letter-spacing:2px;text-transform:uppercase;" +
      "color:var(--muted);margin-top:16px;opacity:.6;";
    badge.textContent = text;
    btns.after(badge);
  }

  function parseCSV(text) {
    const lines   = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
    return lines.slice(1).map(line => {
      const values = line.match(/(".*?"|[^",\n]+)(?=\s*,|\s*$)/g) || [];
      const row    = {};
      headers.forEach((h, i) => {
        row[h] = (values[i] || "")
          .replace(/^"|"$/g, "")
          .replace(/""/g, '"')
          .trim();
      });
      return row;
    });
  }

  load();
})();
