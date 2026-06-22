const DATA_URL = "output/quiz/field_scan_daily.json";

const scoreLabels = {
  storm_lands: "Storm Lands",
  hollow_grounds: "Hollow Grounds",
  still_places: "Still Places",
  lit_realms: "Lit Realms",
};

function formatDate(value) {
  if (!value) return "Daily Field Report";
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderQuiz(scan) {
  const question = scan.questions?.[0];
  const optionsEl = document.getElementById("options");
  const resultEl = document.getElementById("result");
  const resultTitle = document.getElementById("result-title");
  const resultCopy = document.getElementById("result-copy");
  const resultContext = document.getElementById("result-context");

  document.getElementById("scan-date").textContent = formatDate(scan.date);
  document.getElementById("scan-title").textContent = scan.quiz_type === "field_scan"
    ? "Daily Field Scan"
    : "Territory Scan";
  document.getElementById("scan-prompt").textContent = question?.prompt || "Pick the signal that feels closest.";
  document.getElementById("scan-disclaimer").textContent = scan.disclaimer || "This is a daily scan, not your confirmed faction.";

  const fullScanLink = document.getElementById("full-scan-link");
  fullScanLink.href = scan.full_quiz_url || "territory.html";
  fullScanLink.textContent = scan.cta || "Take the full Territory Scan";

  optionsEl.innerHTML = "";
  for (const option of question?.options || []) {
    const button = document.createElement("button");
    button.className = "option";
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <span class="symbol">${option.symbol || ""}</span>
      <span>
        <strong>${option.label}</strong>
        <span>${scoreLabels[option.score_key] || option.score_key}</span>
      </span>
    `;

    button.addEventListener("click", () => {
      for (const el of optionsEl.querySelectorAll(".option")) {
        el.setAttribute("aria-pressed", "false");
      }
      button.setAttribute("aria-pressed", "true");

      resultEl.hidden = false;
      resultTitle.textContent = option.reading || scoreLabels[option.score_key] || "Field Reading";
      resultCopy.textContent = scan.field_readings?.[option.score_key] || "Your answer is today's temporary field reading.";
      resultContext.textContent = `The field today reads ${scan.territory || "Unknown"} (${scan.quadrant || "Unknown"}).`;
      resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    optionsEl.appendChild(button);
  }
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderQuiz(await response.json());
  } catch (error) {
    document.getElementById("scan-title").textContent = "Field Scan Offline";
    document.getElementById("scan-prompt").textContent = "Today's scan data could not be loaded.";
    console.error(error);
  }
}

init();
