/*
 * territory-views.js — aggregate, cookieless view counting for territory feeds
 * and story pages.
 *
 * GitHub Pages serves static files and gives us no server logs, so a visit has
 * to be recorded from the browser. This writes an ANONYMOUS DAILY COUNTER to the
 * same Firebase RTDB the daily field scan already uses, which means the numbers
 * land in a database MIS already syncs into SQLite rather than in a third-party
 * dashboard we would then have to join against.
 *
 *     territory_views/{YYYY-MM-DD}/{mis_slug}   -->  territory_view_counts
 *
 * IT RECORDS THE MIS SLUG, NOT THE PUBLIC NAME
 * --------------------------------------------
 * Pages address territories by PUBLIC name — ?territory=zenith, or
 * data-territory="apex" on a story page — while MIS keys everything by SLUG
 * (the_focus, the_radiance). Recording the public name would produce a table
 * that looks full and joins to nothing: every row silently missing from
 * territory_baseline_tracking, with no error to notice.
 *
 * index.json (written by run_seasonal_scene_build.py from the canonical
 * registry) carries both keys, so the translation lives there rather than in a
 * copy of that table kept here — the same reasoning territory-skin.js uses.
 *
 * Note the mapping is NOT one-to-one: flux and pulse both resolve to the_raw.
 * That is intended. Demand is measured against the field, and the field has
 * thirteen territories.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * No cookie, no localStorage id, no fingerprint, nothing that identifies a
 * person. We only ever need "how many people looked at The Gathering today", so
 * storing anything per-visitor would be collecting data we have no use for — and
 * cookieless counting keeps this clear of consent-banner territory.
 *
 * WHY IT WAITS, AND WHY IT FAILS CLOSED
 * -------------------------------------
 * These numbers are meant to steer how the system evolves. So a hit has to mean
 * "someone read this" rather than "something loaded this" — hence the dwell
 * requirement, which drops crawlers and back-button bounces. And if the slug
 * cannot be resolved, NOTHING is recorded: a row keyed by a name that joins to
 * no territory is worse than a missing row, because it makes the totals look
 * complete while quietly being wrong.
 *
 * Include AFTER the firebase compat SDKs:
 *   <script src=".../firebase-app-compat.js"></script>
 *   <script src=".../firebase-database-compat.js"></script>
 *   <script src="assets/territory-views.js"></script>
 */

(function () {
  "use strict";

  // Same project as territory-scan.js / monthly-territory-scan.js. A Firebase
  // web config is public by design; write access is constrained by RTDB rules,
  // not by hiding this.
  var firebaseConfig = {
    apiKey: "AIzaSyD5wmZYrsEWzWX0widS8BI_yjFfPPHuxRg",
    authDomain: "moodque-data.firebaseapp.com",
    databaseURL: "https://moodque-data-default-rtdb.firebaseio.com",
    projectId: "moodque-data",
    storageBucket: "moodque-data.appspot.com",
    messagingSenderId: "118808686621",
    appId: "1:118808686621:web:fe7cb9d05a916b9448d6f",
  };

  var RTDB_ROOT = "territory_views";
  var DWELL_MS = 3000;          // visible for this long before it counts
  var counted = false;          // one count per page view, whatever happens

  // Derive the assets base from this script's own src, so the file works at any
  // depth — root, /territory/, or /story/ — without a path table.
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var ASSETS_BASE = scriptSrc.replace(/\/territory-views\.js.*$/, "");

  /* Public territory name, from the query string or the page itself.
   * index.html and territory-skin.js address feeds as ?territory=<name>;
   * the story pages carry data-territory on an element instead. */
  function resolvePublicName() {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get("territory") || params.get("tid");
    if (fromQuery) return fromQuery.trim().toLowerCase();

    var el = document.querySelector("[data-territory]");
    if (el && el.getAttribute("data-territory")) {
      return el.getAttribute("data-territory").trim().toLowerCase();
    }
    return null;
  }

  /* Public name -> MIS slug, via the generated registry.
   * backgrounds maps BOTH keys to a filename: "apex" -> "the_radiance.png" and
   * "the_radiance" -> "the_radiance.png". Stripping the extension gives the slug
   * either way, so a page that already uses a slug passes through unchanged. */
  function resolveSlug(publicName) {
    return fetch(ASSETS_BASE + "/field_backgrounds/index.json", { cache: "force-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (index) {
        var file = index && index.backgrounds && index.backgrounds[publicName];
        if (!file) return null;
        return String(file).replace(/\.[a-z0-9]+$/i, "");
      })
      .catch(function () { return null; });
  }

  /* Local calendar date, matching how daily_scans keys its nodes. */
  function today() {
    var d = new Date();
    return (
      d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function record(slug) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

      // ServerValue.increment is atomic, so simultaneous readers cannot clobber
      // each other's count the way a read-then-write would.
      firebase
        .database()
        .ref(RTDB_ROOT + "/" + today() + "/" + slug)
        .set(firebase.database.ServerValue.increment(1))
        .catch(function (err) {
          // Analytics must never break the page it is measuring.
          if (window.console) console.debug("territory view not recorded:", err);
        });
    } catch (err) {
      if (window.console) console.debug("territory view not recorded:", err);
    }
  }

  /* Count once the tab has been genuinely visible for DWELL_MS. The timer is
   * cancelled if the reader leaves or hides the tab first, so a background
   * prefetch never counts. */
  function arm(publicName) {
    var timer = null;

    function fire() {
      if (counted) return;
      counted = true;
      resolveSlug(publicName).then(function (slug) {
        if (!slug) {
          // Fail closed — see the header note on why an unjoinable row is worse
          // than a missing one.
          if (window.console) {
            console.debug("territory view not recorded: no slug for", publicName);
          }
          return;
        }
        record(slug);
      });
    }

    function start() {
      if (timer === null && !counted) timer = window.setTimeout(fire, DWELL_MS);
    }

    function stop() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") start();
      else stop();
    });

    if (document.visibilityState === "visible") start();
  }

  var publicName = resolvePublicName();
  if (!publicName) return;                      // not a territory page; nothing to count

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { arm(publicName); });
  } else {
    arm(publicName);
  }
})();
