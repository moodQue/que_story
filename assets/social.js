(function () {
  var pageUrl = window.location.href;
  var likeKey = "que:like:" + pageUrl;

  function isLiked() {
    return localStorage.getItem(likeKey) === "1";
  }

  function getTitle() {
    var h1 = document.querySelector("h1");
    return (h1 && h1.textContent.trim()) || document.title || "A signal from Que";
  }

  var CSS =
    ".social-bar{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;align-items:flex-start}" +
    ".social-btn{font-family:'Trebuchet MS',Arial,sans-serif;font-size:12px;font-weight:900;" +
    "letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;" +
    "border:2px solid rgba(244,241,223,.55);padding:9px 14px;" +
    "background:transparent;color:#f4f1df;box-shadow:3px 3px 0 rgba(0,0,0,.65);" +
    "transition:border-color .15s,color .15s,background .15s}" +
    ".social-btn:hover{background:rgba(255,255,255,.07);border-color:#f4f1df}" +
    ".social-btn.liked{color:#f1c76a;border-color:#f1c76a}" +
    ".share-tray{display:none;flex-wrap:wrap;gap:8px;margin-top:8px;width:100%}" +
    ".share-tray.open{display:flex}" +
    ".share-tray .social-btn{font-size:11px;padding:6px 10px;box-shadow:2px 2px 0 rgba(0,0,0,.65)}";

  function addStyle() {
    var s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function makeLikeBtn() {
    var btn = document.createElement("button");
    var state = isLiked();
    btn.className = "social-btn btn-like" + (state ? " liked" : "");
    btn.setAttribute("aria-pressed", String(state));
    btn.textContent = state ? "♥ Liked" : "♥ Like";

    btn.addEventListener("click", function () {
      var next = !isLiked();
      localStorage.setItem(likeKey, next ? "1" : "0");
      btn.className = "social-btn btn-like" + (next ? " liked" : "");
      btn.setAttribute("aria-pressed", String(next));
      btn.textContent = next ? "♥ Liked" : "♥ Like";
    });

    return btn;
  }

  function enc(s) { return encodeURIComponent(s); }

  function openTab(href) {
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function copyLink(btn) {
    var original = btn.textContent;
    function done() {
      btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = original; }, 2000);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pageUrl).then(done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = pageUrl;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      done();
    }
  }

  function makeShareBtn() {
    var wrap = document.createElement("div");

    var toggle = document.createElement("button");
    toggle.className = "social-btn btn-share";
    toggle.textContent = "↗ Share";

    var tray = document.createElement("div");
    tray.className = "share-tray";

    var platforms = [
      {
        label: "Copy Link",
        fn: function (btn) { copyLink(btn); }
      },
      {
        label: "X",
        fn: function () {
          openTab("https://twitter.com/intent/tweet?url=" + enc(pageUrl) + "&text=" + enc(getTitle()));
        }
      },
      {
        label: "Facebook",
        fn: function () {
          openTab("https://www.facebook.com/sharer/sharer.php?u=" + enc(pageUrl));
        }
      },
      {
        label: "WhatsApp",
        fn: function () {
          openTab("https://api.whatsapp.com/send?text=" + enc(getTitle() + " " + pageUrl));
        }
      }
    ];

    platforms.forEach(function (p) {
      var btn = document.createElement("button");
      btn.className = "social-btn";
      btn.textContent = p.label;
      btn.addEventListener("click", function () { p.fn(btn); });
      tray.appendChild(btn);
    });

    toggle.addEventListener("click", function () {
      var open = tray.classList.toggle("open");
      toggle.textContent = open ? "✕ Close" : "↗ Share";
    });

    wrap.appendChild(toggle);
    wrap.appendChild(tray);
    return wrap;
  }

  function init() {
    var anchor = document.querySelector(".btns") || document.querySelector(".scene-actions");
    if (!anchor) return;

    addStyle();

    var bar = document.createElement("div");
    bar.className = "social-bar";
    bar.appendChild(makeLikeBtn());
    bar.appendChild(makeShareBtn());

    anchor.after(bar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
