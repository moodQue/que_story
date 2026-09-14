/**
 * story-loader.js — Que Story Engine Bridge
 *
 * Reads ?story=ISSUE_ID from the URL and injects the matching story
 * content from data/stories.json into the current page.
 *
 * Data source: /que_story/data/stories.json
 * Built each week by que_engine from the discord export JSONs.
 * Keys are full issue IDs: "2026-05-03_alignment_capricorn_674"
 *
 * Required page elements: .episode-body, .eyebrow, .hero, .btns
 */

(function () {
  const STORIES_URL =
    "https://moodque.github.io/que_story/data/stories.json";

  const params  = new URLSearchParams(window.location.search);
  const storyId = params.get("story");

  // No param → keep static seed content, do nothing
  if (!storyId) return;

  async function load() {
    try {
      const res = await fetch(STORIES_URL);
      if (!res.ok) throw new Error("stories.json fetch failed: " + res.status);
      const stories = await res.json();

      const story = stories[storyId];

      if (!story) {
        appendSignalNote("Signal not found — showing seed content.");
        return;
      }

      // Inject story body.
      //
      // Prefer the weekly mythology story (`story`: an array of paragraphs, the last one
      // an engagement question), attached by stories_publisher from 2026-09-14. Fall back
      // to `blurb` -- the Discord teaser template ("In the space of X, under the influence
      // of Y -- a story occurred") -- which is all this page ever showed before, and all
      // that older entries have.
      const bodyEl = document.querySelector(".episode-body");
      if (bodyEl && Array.isArray(story.story) && story.story.length) {
        bodyEl.textContent = "";
        story.story.forEach(function (para, i) {
          const p = document.createElement("p");
          p.textContent = para;
          // The closing question is the ask; let it read as one.
          if (i === story.story.length - 1 && story.story.length > 1) {
            p.className = "episode-question";
          }
          bodyEl.appendChild(p);
        });
        if (story.story_title) {
          const label = document.querySelector(".episode-label");
          if (label) label.textContent = story.story_title;
        }
        if (story.story_week) {
          const meta = document.createElement("p");
          meta.className = "episode-meta";
          meta.textContent = "The week of " + story.story_week.replace(" to ", " → ");
          bodyEl.appendChild(meta);
        }
      } else if (bodyEl && story.blurb) {
        bodyEl.textContent = story.blurb;
      }

      // Override page title with story title
      if (story.title) {
        const h1 = document.querySelector("h1");
        if (h1) h1.textContent = story.title;
        document.title = story.title + " | MoodQue";
      }

      // Update eyebrow with territory + emoji
      if (story.territory) {
        const ew = document.querySelector(".eyebrow");
        if (ew) {
          ew.textContent = story.territory + (story.emoji_hint ? "  " + story.emoji_hint : "");
        }
      }

      appendSignalNote("Signal confirmed · " + storyId.replace(/_/g, " "));

    } catch (err) {
      // Fail silently — static seed content remains visible
      console.warn("[story-loader] Could not load story signal:", err);
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

  load();
})();
