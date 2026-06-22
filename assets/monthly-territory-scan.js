const QUIZ_URL = "output/quiz/monthly_assignment_current.json";

const firebaseConfig = {
  apiKey: "AIzaSyD5wmZYrsEWzWX0widS8BI_yjFfPPHuxRg",
  authDomain: "moodque-data.firebaseapp.com",
  databaseURL: "https://moodque-data-default-rtdb.firebaseio.com",
  projectId: "moodque-data",
  storageBucket: "moodque-data.appspot.com",
  messagingSenderId: "118808686621",
  appId: "1:118808686621:web:fe7cb9d05a916b9448d6f",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let quiz = null;
let index = 0;
let answers = [];

const factionNames = {
  current: "The Current",
  static: "The Static",
  hollow: "The Hollow",
  calm: "The Calm",
  wandering: "The Wandering",
};

const territories = {
  the_gathering: { name: "The Gathering", vac: { v: 0.50, a: 0.40, c: 0.30 } },
  the_current: { name: "The Current", vac: { v: 0.70, a: 0.70, c: 0.60 } },
  the_radiance: { name: "The Radiance", vac: { v: 0.90, a: 0.90, c: 0.40 } },
  the_static: { name: "The Static", vac: { v: -0.30, a: 0.50, c: -0.30 } },
  the_pressure: { name: "The Pressure", vac: { v: -0.50, a: 0.70, c: -0.10 } },
  the_raw: { name: "The Raw", vac: { v: -0.70, a: 0.90, c: 0.50 } },
  the_weight: { name: "The Weight", vac: { v: -0.40, a: -0.40, c: -0.40 } },
  the_drift: { name: "The Drift", vac: { v: -0.15, a: -0.45, c: -0.30 } },
  the_hollow: { name: "The Hollow", vac: { v: -0.80, a: -0.70, c: -0.60 } },
  the_focus: { name: "The Focus", vac: { v: 0.20, a: -0.10, c: 0.80 } },
  the_calm: { name: "The Calm", vac: { v: 0.50, a: -0.50, c: 0.60 } },
  the_ethereal: { name: "The Ethereal", vac: { v: 0.70, a: -0.80, c: 0.30 } },
  the_wandering: { name: "The Wandering", vac: { v: 0.00, a: -0.30, c: 0.10 } },
};

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function distance(a, b) {
  return Math.hypot(a.v - b.v, a.a - b.a, a.c - b.c);
}

function score() {
  const factionScores = { current: 0, static: 0, hollow: 0, calm: 0 };
  const territoryScores = {};
  const domainScores = {};
  const vac = { v: 0, a: 0, c: 0 };

  for (const item of answers) {
    factionScores[item.faction] = (factionScores[item.faction] || 0) + (item.weight || 1);
    territoryScores[item.territory] = (territoryScores[item.territory] || 0) + (item.weight || 1);
    for (const domain of item.domains || []) {
      domainScores[domain] = (domainScores[domain] || 0) + 1;
    }
    vac.v += item.vac.v;
    vac.a += item.vac.a;
    vac.c += item.vac.c;
  }

  const count = Math.max(1, answers.length);
  vac.v = clamp(vac.v / count);
  vac.a = clamp(vac.a / count);
  vac.c = clamp(vac.c / count);

  const rankedFactions = Object.entries(factionScores).sort((a, b) => b[1] - a[1]);
  const top = rankedFactions[0];
  const runnerUp = rankedFactions[1];
  const primaryFaction = top[1] === runnerUp[1] ? "wandering" : top[0];
  const confidence = top[1] === 0 ? 0 : (top[1] - runnerUp[1]) / top[1];

  let nearestTerritory = "the_wandering";
  let nearestDistance = Infinity;
  for (const [key, territory] of Object.entries(territories)) {
    const d = distance(vac, territory.vac);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearestTerritory = key;
    }
  }

  const votedTerritory = Object.entries(territoryScores).sort((a, b) => b[1] - a[1])[0]?.[0];
  const primaryTerritory = votedTerritory || nearestTerritory;

  return {
    quiz_id: quiz.quiz_id,
    quiz_version: quiz.quiz_version,
    source_month: quiz.source_month,
    completed_at: new Date().toISOString(),
    viewer_handle: document.getElementById("viewer-handle").value.trim() || null,
    primary_faction: primaryFaction,
    primary_faction_name: factionNames[primaryFaction],
    primary_territory: primaryTerritory,
    primary_territory_name: territories[primaryTerritory]?.name || primaryTerritory,
    nearest_vac_territory: nearestTerritory,
    nearest_vac_territory_name: territories[nearestTerritory].name,
    confidence: Number(confidence.toFixed(4)),
    personal_vac: {
      valence: Number(vac.v.toFixed(4)),
      arousal: Number(vac.a.toFixed(4)),
      control: Number(vac.c.toFixed(4)),
    },
    domain_scores: domainScores,
    faction_scores: factionScores,
    answers: answers.map((answer) => ({
      question_id: answer.question_id,
      answer_id: answer.answer_id,
      faction: answer.faction,
      territory: answer.territory,
      vac: answer.vac,
      source_topic_id: answer.source_topic_id,
    })),
    playlist_seed: {
      target_valence: Number(((vac.v + 1) / 2).toFixed(4)),
      target_energy: Number(((vac.a + 1) / 2).toFixed(4)),
      target_control: Number(((vac.c + 1) / 2).toFixed(4)),
    },
  };
}

function setPanel(name) {
  for (const id of ["intro", "quiz", "results"]) {
    document.getElementById(id).hidden = id !== name;
  }
}

function renderQuestion() {
  const question = quiz.questions[index];
  document.getElementById("progress").textContent = `${index + 1} / ${quiz.questions.length}`;
  document.getElementById("question-meta").textContent = `${question.category} · ${question.centroid}`;
  document.getElementById("question-text").textContent = question.prompt;

  const answersEl = document.getElementById("answers");
  answersEl.innerHTML = "";
  for (const option of question.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer";
    button.innerHTML = `<strong>${option.label}</strong><span>${factionNames[option.faction]} · ${territories[option.territory]?.name || option.territory}</span>`;
    button.addEventListener("click", () => {
      answers.push({
        ...option,
        question_id: question.id,
        source_topic_id: question.source_topic_id,
      });
      index += 1;
      if (index >= quiz.questions.length) {
        renderResults();
      } else {
        renderQuestion();
      }
    });
    answersEl.appendChild(button);
  }
}

async function saveResult(result) {
  const saveState = document.getElementById("save-state");
  try {
    const ref = db.ref(`quiz_assignments/${quiz.source_month}`).push();
    await ref.set(result);
    saveState.textContent = `Saved assignment ${ref.key}. Use this result for Discord role claim and playlist generation.`;
  } catch (error) {
    saveState.textContent = "Result computed locally. Firebase save failed.";
    console.error(error);
  }
}

function renderResults() {
  const result = score();
  setPanel("results");
  document.getElementById("progress").textContent = `${quiz.questions.length} / ${quiz.questions.length}`;
  document.getElementById("result-faction").textContent = result.primary_faction_name;
  document.getElementById("result-territory").textContent = `${result.primary_territory_name} · nearest VAC territory: ${result.nearest_vac_territory_name}`;
  document.getElementById("metric-v").textContent = result.personal_vac.valence.toFixed(2);
  document.getElementById("metric-a").textContent = result.personal_vac.arousal.toFixed(2);
  document.getElementById("metric-c").textContent = result.personal_vac.control.toFixed(2);
  document.getElementById("metric-confidence").textContent = `${Math.round(result.confidence * 100)}%`;
  saveResult(result);
}

async function init() {
  const response = await fetch(QUIZ_URL, { cache: "no-store" });
  quiz = await response.json();
  document.getElementById("source-month").textContent = `${quiz.source_month} · ${quiz.question_count} questions`;
  document.getElementById("start").addEventListener("click", () => {
    setPanel("quiz");
    renderQuestion();
  });
  document.getElementById("restart").addEventListener("click", () => {
    index = 0;
    answers = [];
    setPanel("intro");
    document.getElementById("progress").textContent = `0 / ${quiz.questions.length}`;
  });
}

init().catch((error) => {
  document.getElementById("title").textContent = "Monthly Scan Offline";
  console.error(error);
});
