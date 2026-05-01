(function () {
  const configUrl = new URL("../scenes.json", window.location.href);
  const rootPath = getRootPath();
  const pageUrl = getScenePath(window.location.pathname);

  loadScene();
  applyTimeOverlay();

  async function loadScene() {
    try {
      const response = await fetch(configUrl);
      const scenes = await response.json();
      const scene = scenes.find(item => normalize(item.url) === normalize(pageUrl));

      if (!scene) {
        setText("scene-title", "Signal Not Found");
        setText("scene-copy", "This QR signal has not been tuned yet.");
        return;
      }

      document.title = `${scene.title || titleCase(scene.centroid)} | Que`;
      document.documentElement.style.setProperty("--scene-image", `url("${rootPath + scene.image.replace(/^\//, "")}")`);
      setText("scene-week", scene.week);
      setText("scene-title", scene.title || titleCase(scene.centroid));
      setText("scene-copy", scene.copy || "");

      const merch = document.getElementById("merch-link");
      if (merch && scene.merch) {
        merch.hidden = false;
        merch.href = rootPath + scene.merch.replace(/^\//, "");
      }

      const egg = document.getElementById("easter-egg");
      if (egg && scene.easter_egg && Math.random() < 0.28) {
        egg.hidden = false;
        egg.href = rootPath + scene.easter_egg.replace(/^\//, "");
        requestAnimationFrame(() => egg.classList.add("is-visible"));
      }

      const qr = document.getElementById("qr-reference");
      if (qr && scene.qr) {
        qr.hidden = false;
        qr.src = rootPath + scene.qr.replace(/^\//, "");
      }

      console.log("[que-scene]", {
        week: scene.week,
        centroid: scene.centroid,
        url: scene.url,
      });
    } catch (error) {
      console.warn("[que-scene] Could not load scene config:", error);
      setText("scene-title", "Signal Error");
      setText("scene-copy", "This scene could not load its signal.");
    }
  }

  function applyTimeOverlay() {
    const hour = new Date().getHours();
    const opacity = hour >= 20 || hour < 6 ? ".24" : ".06";
    document.documentElement.style.setProperty("--night-opacity", opacity);
  }

  function getRootPath() {
    const match = window.location.pathname.match(/^(.+?)\/scenes\//);
    return match ? `${match[1]}/` : "/";
  }

  function getScenePath(pathname) {
    const cleanPath = pathname.replace(/\/index\.html$/, "/");
    if (rootPath !== "/" && cleanPath.startsWith(rootPath)) {
      return `/${cleanPath.slice(rootPath.length)}`;
    }
    return cleanPath;
  }

  function normalize(value) {
    return value.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function titleCase(value) {
    return (value || "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }
})();
