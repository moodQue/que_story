/*
 * territory-skin.js — swap the hero background to the current territory's seasonal art.
 *
 * WHY THIS EXISTS:
 *   territory/index.html and story.html both hardcoded ONE background
 *   (assets/centroids/the-calm-night.png) for every territory and every story, so a viewer
 *   who scanned into The Pressure saw The Calm's artwork. The monthly seasonal re-skin now
 *   publishes all 13 territory backgrounds into assets/field_backgrounds/, and this points
 *   each page at its own.
 *
 * NAMING:
 *   Pages address territories by PUBLIC name (?territory=zenith) while the files are named by
 *   MIS slug (the_focus.png). index.json, written by run_seasonal_scene_build.py from the
 *   canonical registry, carries BOTH keys so this file never has to hold a copy of that table.
 *
 * FAILING SOFT IS DELIBERATE:
 *   If index.json is missing, the territory is unknown, or the image 404s, the CSS background
 *   already in the stylesheet stays exactly as it is. A page with the old artwork is fine; a
 *   page with no artwork is not.
 */
(function () {
  "use strict";

  var HERO = ".hero";

  function rootPath() {
    // territory/index.html sits one level down; story.html is at the root.
    return window.location.pathname.indexOf("/territory/") !== -1 ? "../" : "";
  }

  function territoryKey() {
    var params = new URLSearchParams(window.location.search);
    // ?territory= on the territory page, ?tid= on the hunt landing.
    var key = params.get("territory") || params.get("tid");
    if (key) return key.trim().toLowerCase();

    // Story pages carry no territory param — story-loader.js sets the eyebrow text to the
    // display name, so read it back once it has rendered.
    var eyebrow = document.querySelector(".eyebrow");
    if (eyebrow && eyebrow.textContent) {
      var text = eyebrow.textContent.trim().toLowerCase();
      // "The Focus  🌿" -> "the_focus"
      var words = text.replace(/[^a-z ]/g, "").trim().split(/\s+/);
      if (words.length >= 2) return words[0] + "_" + words[1];
    }
    return null;
  }

  function apply(url) {
    var hero = document.querySelector(HERO);
    if (!hero) return;
    hero.style.backgroundImage =
      "linear-gradient(rgba(7,17,28,.3), rgba(7,17,28,.88)), url('" + url + "')";
  }

  function load() {
    var key = territoryKey();
    if (!key) return;

    var base = rootPath() + "assets/field_backgrounds/";
    fetch(base + "index.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.backgrounds) return;
        var file = data.backgrounds[key];
        if (!file) return;
        // Only swap once the image really loads, so a 404 leaves the CSS default alone.
        var probe = new Image();
        probe.onload = function () { apply(base + file); };
        probe.src = base + file;
      })
      .catch(function () { /* keep the stylesheet background */ });
  }

  if (document.readyState === "loading") {
    // Story pages need story-loader.js to have written the eyebrow first; one frame after
    // DOMContentLoaded is enough and avoids ordering assumptions between the two scripts.
    document.addEventListener("DOMContentLoaded", function () { setTimeout(load, 0); });
  } else {
    setTimeout(load, 0);
  }
})();
