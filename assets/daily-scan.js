// assets/daily-scan.js — the six-question Daily Field Scan.
//
// Runs on territory-scan.html AFTER territory-scan.js (it reuses resolveNetwork() and
// resolveCampaign() from there). It only takes over when BOTH are true:
//   1. today's quiz is published:  output/quiz/scenario/index.json -> <today ET>.json
//   2. the scoring service is on:  GET <api>/status returns 200
// Otherwise it does nothing and the one-tap scan stays. That is the feature flag.
//
// Scoring is private: the page sends option ids to the moodQue API (Railway), gets the
// reading back and renders it right here. The viewer never leaves the page.
(function () {
  "use strict";

  const API = (document.currentScript && document.currentScript.dataset.scanApi) || "";
  const INDEX_URL = "output/quiz/scenario/index.json";
  const KEY_STORE = "moodque_scan_participant";
  const FACTION_COLORS = { LIT: "#14E6F3", STORM: "#A553A5", HOLLOW: "#7D619E", STILL: "#ECA35E" };

  const $ = (id) => document.getElementById(id);
  let quiz = null;
  let index = 0;
  const picks = {};            // question id -> option id | null (skipped)
  let lastShareId = null;
  let lastReading = null;

  // ── helpers ────────────────────────────────────────────────────────────────
  /** Today's date in Eastern time — the server rejects any other day. */
  function todayET() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  /** Anonymous random key for this browser (the server stores only a salted hash). */
  function participantKey() {
    let key = null;
    try { key = localStorage.getItem(KEY_STORE); } catch (e) { /* private mode */ }
    if (!key) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      try { localStorage.setItem(KEY_STORE, key); } catch (e) { /* keep in memory */ }
    }
    return key;
  }

  /** Stable per-person option rotation: same order on Back, different across people. */
  function rotated(options, seed) {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const shift = options.length ? h % options.length : 0;
    return options.slice(shift).concat(options.slice(0, shift));
  }

  function show(id) {
    for (const s of ["sc-intro", "sc-question", "sc-finish", "sc-result"]) $(s).hidden = s !== id;
  }

  function focus(id) {
    const el = $(id);
    if (el) el.focus({ preventScroll: false });
  }

  async function getJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── questions ──────────────────────────────────────────────────────────────
  function renderQuestion() {
    const q = quiz.questions[index];
    $("sc-progress").textContent = `${index + 1} / ${quiz.questions.length}`;
    $("sc-prompt").textContent = q.prompt;
    const box = $("sc-options");
    box.innerHTML = "";
    for (const opt of rotated(q.options, participantKey() + q.id)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "option sc-option";
      b.setAttribute("aria-pressed", String(picks[q.id] === opt.id));
      b.innerHTML = "<span></span>";
      b.firstChild.textContent = opt.text;
      b.addEventListener("click", () => {
        picks[q.id] = opt.id;
        for (const el of box.querySelectorAll(".option")) el.setAttribute("aria-pressed", "false");
        b.setAttribute("aria-pressed", "true");
        $("sc-next").disabled = false;
      });
      box.appendChild(b);
    }
    $("sc-back").disabled = index === 0;
    $("sc-next").disabled = !(q.id in picks) || picks[q.id] === null;
    $("sc-next").textContent = index === quiz.questions.length - 1 ? "Finish" : "Next";
    show("sc-question");
    focus("sc-prompt");
  }

  function advance() {
    if (index < quiz.questions.length - 1) {
      index += 1;
      renderQuestion();
    } else {
      show("sc-finish");
      focus("sc-finish-title");
    }
  }

  // ── submit + result ────────────────────────────────────────────────────────
  async function submit() {
    const state = $("sc-state");
    const button = $("sc-submit");
    button.disabled = true;
    state.textContent = "Reading the field…";
    const profile = $("sc-profile").checked;
    const handle = ($("sc-handle").value || "").trim().replace(/^@+/, "").slice(0, 40);
    const body = {
      scan_set_id: quiz.scan_set_id,
      participant_key: participantKey(),
      answers: quiz.questions.map((q) => ({ question_id: q.id, option_id: picks[q.id] ?? null })),
      community_opt_in: $("sc-vote").checked,
      profile_opt_in: profile,
      handle: profile && handle ? handle : null,
      referrer_network: typeof resolveNetwork === "function" ? resolveNetwork() : null,
      campaign: typeof resolveCampaign === "function" ? resolveCampaign() : null,
    };
    try {
      const res = await fetch(`${API}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        state.textContent = res.status === 409
          ? "Today's scan has changed. Reload the page for the new one."
          : res.status === 429 ? "Lots of scans right now. Try again in a few minutes."
          : "We couldn't read it just now. Your answers are kept; try again.";
        button.disabled = false;
        return;
      }
      state.textContent = "";
      button.disabled = false;
      lastShareId = data.share_id;
      lastReading = data.reading;
      try {
        localStorage.setItem(`moodque_scenario_${quiz.date}`, JSON.stringify({ reading: data.reading,
          share_id: data.share_id, vote_counted: data.vote_counted }));
      } catch (e) { /* fine */ }
      renderResult(data.reading, data.vote_counted, data.saved_to_profile);
    } catch (e) {
      state.textContent = "No connection. Your answers are kept; try again.";
      button.disabled = false;
    }
  }

  function renderResult(r, voteCounted, savedToProfile) {
    const title = $("sc-r-faction");
    if (r.faction) {
      title.textContent = r.faction_name;
      title.style.color = FACTION_COLORS[r.faction] || "";
    } else {
      title.textContent = "Somewhere in between";
      title.style.color = "";
    }
    $("sc-r-status").textContent =
      r.status === "scored" ? `Confidence: ${r.confidence}.`
      : r.status === "tentative" ? "Leaning this way. Your answers pulled in a few directions, so read it lightly."
      : "Not enough signal on how today is going. That's fine; some days don't sort neatly.";
    $("sc-r-direction").textContent = r.desired_direction ? `Where you want to go: ${r.desired_direction}.` : "";
    $("sc-r-step").textContent = r.next_step ? `One small thing: ${r.next_step}` : "";
    const why = $("sc-r-why");
    why.innerHTML = "";
    for (const line of r.rationale || []) {
      const li = document.createElement("li");
      li.textContent = line.text;
      why.appendChild(li);
    }
    const notes = [];
    if (voteCounted) notes.push([1, 3, 5].includes(new Date(quiz.date + "T12:00:00").getDay())
      ? "Your scan counts toward tonight's Evening Rebalance if you scanned before 5 PM ET."
      : "Your scan is counted. Evening Rebalance runs Mon · Wed · Fri.");
    if (savedToProfile) notes.push("Saved to your moodQue profile.");
    $("sc-r-vote").textContent = notes.join(" ");
    $("sc-share").hidden = !r.faction;
    show("sc-result");
    focus("sc-r-faction");
  }

  async function share() {
    const r = lastReading;
    if (!r || !r.faction) return;
    const url = `${location.origin}${location.pathname}?shared=${encodeURIComponent(lastShareId || "")}&src=share`;
    const text = `My moodQue Field Scan today: ${r.faction_name}. Weather, not identity. Where are you?`;
    const state = $("sc-share-state");
    try {
      if (navigator.share) {
        await navigator.share({ title: "moodQue Field Scan", text, url });
        state.textContent = "";
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        state.textContent = "Copied. Paste it anywhere.";
      }
    } catch (e) {
      if (e && e.name !== "AbortError") state.textContent = "Couldn't share from this browser. Copy the page link instead.";
    }
  }

  // ── shared-link banner (someone else's reading: faction only, never answers) ──
  async function showSharedBanner() {
    const id = new URLSearchParams(location.search).get("shared");
    if (!id || id.length > 20) return;
    try {
      const s = await getJSON(`${API}/share/${encodeURIComponent(id)}`);
      if (!s.faction_name) return;
      const el = $("sc-shared");
      el.textContent = `A friend's scan read ${s.faction_name} on ${s.date}. Where are you today?`;
      el.hidden = false;
    } catch (e) { /* expired or invalid: just skip the banner */ }
  }

  // ── boot ───────────────────────────────────────────────────────────────────
  async function boot() {
    if (!API || !window.fetch || !window.crypto) return;
    const today = todayET();
    let file;
    try {
      const idx = await getJSON(INDEX_URL);
      file = idx.sets && idx.sets[today];
      if (!file) return;                                    // no quiz today: keep one-tap
      quiz = await getJSON(`output/quiz/scenario/${file}`);
      const status = await fetch(`${API}/status`, { cache: "no-store" });
      if (!status.ok) return;                               // scoring off: keep one-tap
    } catch (e) {
      return;                                               // anything odd: keep one-tap
    }
    if (!quiz || quiz.date !== today || !(quiz.questions || []).length) return;

    // Take over the page.
    for (const sel of [".hero-block", "#options", "#result"]) {
      const el = document.querySelector(`.report > ${sel}`);
      if (el) el.hidden = true;
    }
    $("scan-title") && ($("scan-title").textContent = "Daily Field Scan");
    const dateEl = $("scan-date");
    if (dateEl) {
      // The one-tap scan writes its own date here asynchronously; the quiz date wins.
      const label = new Date(quiz.date + "T12:00:00").toLocaleDateString("en-US",
        { month: "short", day: "numeric", year: "numeric" }).toLowerCase();
      dateEl.textContent = label;
      new MutationObserver(() => { if (dateEl.textContent !== label) dateEl.textContent = label; })
        .observe(dateEl, { childList: true, characterData: true, subtree: true });
    }
    $("scenario").hidden = false;
    $("sc-intro").querySelector(".prompt").textContent =
      `${quiz.questions.length} quick everyday scenes. About a minute. Pick what's true right now. There are no wrong answers.`;

    $("sc-start").addEventListener("click", () => { index = 0; renderQuestion(); });
    $("sc-back").addEventListener("click", () => { if (index > 0) { index -= 1; renderQuestion(); } });
    $("sc-skip").addEventListener("click", () => { picks[quiz.questions[index].id] = null; advance(); });
    $("sc-next").addEventListener("click", advance);
    $("sc-review").addEventListener("click", () => { index = 0; renderQuestion(); });
    $("sc-profile").addEventListener("change", (e) => { $("sc-handle-row").hidden = !e.target.checked; });
    $("sc-submit").addEventListener("click", submit);
    $("sc-share").addEventListener("click", share);
    $("sc-retake").addEventListener("click", () => {
      for (const k of Object.keys(picks)) delete picks[k];
      index = 0;
      renderQuestion();
    });

    showSharedBanner();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(`moodque_scenario_${today}`) || "null"); } catch (e) { /* none */ }
    if (saved && saved.reading) {
      lastReading = saved.reading;
      lastShareId = saved.share_id;
      $("sc-r-kicker").textContent = "Your reading from earlier today";
      renderResult(saved.reading, saved.vote_counted, false);
    }
  }

  boot();
})();
