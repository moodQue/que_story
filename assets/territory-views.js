/*
 * territory-views.js — aggregate, cookieless view counting for territory feeds.
 *
 * GitHub Pages serves static files and gives us no server logs, so a visit has
 * to be recorded from the browser. This writes an ANONYMOUS DAILY COUNTER to the
 * same Firebase RTDB the daily field scan already uses, which means the numbers
 * land in a database MIS already syncs into SQLite rather than in a third-party
 * dashboard we would then have to join against.
 *
 *     territory_views/{YYYY-MM-DD}/{territory}   -->  territory_view_counts
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * No cookie, no localStorage id, no fingerprint, nothing that identifies a
 * person. We only ever need "how many people looked at The Gathering today", so
 * storing anything per-visitor would be collecting data we have no use for — and
 * it is cookieless counting that keeps this clear of consent-banner territory.
 *
 * WHY IT WAITS BEFORE COUNTING
 * ----------------------------
 * These numbers are meant to steer how the system evolves, so a hit has to mean
 * "someone read this" rather than "something loaded this". Crawlers, link
 * unfurlers and instant back-button bounces all fetch the page. Requiring the
 * tab to be visible for DWELL_MS before counting drops most of that.
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

  /* Territory slug, from the query string or the page itself.
   * index.html and territory-skin.js address feeds as ?territory=<slug>;
   * the story pages carry data-territory on an element instead. */
  function resolveTerritory() {
    var fromQuery = new URLSearchParams(window.location.search).get("territory");
    if (fromQuery) return fromQuery.trim().toLowerCase();

    var el = document.querySelector("[data-territory]");
    if (el && el.getAttribute("data-territory")) {
      return el.getAttribute("data-territory").trim().toLowerCase();
    }
    return null;
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

  function record(territory) {
    if (counted) return;
    counted = true;

    try {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

      // ServerValue.increment is atomic, so simultaneous readers cannot clobber
      // each other's count the way a read-then-write would.
      firebase
        .database()
        .ref(RTDB_ROOT + "/" + today() + "/" + territory)
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
  function arm(territory) {
    var timer = null;

    function start() {
      if (timer === null && !counted) {
        timer = window.setTimeout(function () {
          record(territory);
        }, DWELL_MS);
      }
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

  var territory = resolveTerritory();
  if (!territory) return;                       // not a territory feed; nothing to count

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { arm(territory); });
  } else {
    arm(territory);
  }
})();
