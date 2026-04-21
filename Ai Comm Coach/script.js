const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const liveTranscript = document.getElementById("liveTranscript");
const suggestionsWrap = document.getElementById("suggestions");
const aiReplyEl = document.getElementById("aiReply");
const statusPill = document.getElementById("statusPill");
const modeGrid = document.getElementById("modeGrid");
const calcFeedbackBtn = document.getElementById("calcFeedbackBtn");
const grammarScoreEl = document.getElementById("grammarScore");
const fluencyScoreEl = document.getElementById("fluencyScore");
const confidenceScoreEl = document.getElementById("confidenceScore");
const improvementTips = document.getElementById("improvementTips");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let selectedMode = "Interview";
let sessionEntries = [];
let latestText = "";

function setStatus(label, listening = false) {
  statusPill.textContent = label;
  statusPill.classList.toggle("listening", listening);
}

function renderSuggestions(items) {
  suggestionsWrap.innerHTML = "";

  if (!items.length) {
    const chip = document.createElement("button");
    chip.className = "suggestion-chip";
    chip.disabled = true;
    chip.textContent = "Suggestions appear here";
    suggestionsWrap.appendChild(chip);
    return;
  }

  items.forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "suggestion-chip";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      latestText = text;
      liveTranscript.textContent = text;
    });
    suggestionsWrap.appendChild(chip);
  });
}

function improveSentence(input) {
  const cleaned = input.trim();
  if (!cleaned) {
    return [];
  }

  const corrected = cleaned
    .replace(/\bi\b/g, "I")
    .replace(/\bu\b/gi, "you")
    .replace(/\bim\b/gi, "I am")
    .replace(/\bwanna\b/gi, "want to")
    .replace(/\bgonna\b/gi, "going to")
    .replace(/\bjob in your company\b/gi, "a role at your company")
    .replace(/\s+/g, " ")
    .trim();

  const professional = corrected
    .replace(/^I want/gi, "I am interested")
    .replace(/^Can you/gi, "Could you")
    .replace(/\bhelp me\b/gi, "assist me")
    .replace(/\bthanks\b/gi, "thank you");

  const concise = corrected
    .replace(/\bI am interested in\b/gi, "Interested in")
    .replace(/\bI would like to\b/gi, "I want to")
    .replace(/\breally\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const titleCase = corrected.charAt(0).toUpperCase() + corrected.slice(1);

  return Array.from(new Set([titleCase, professional, concise])).filter(Boolean).slice(0, 3);
}

function buildModeReply(userText, mode) {
  const templates = {
    Interview: `Good answer. In an interview, try adding one specific achievement with confidence. You said: "${userText}"`,
    Casual: `Nice and natural. You can keep it friendly and short: "${userText}" sounds good.`,
    Professional: `Clear point. For office communication, keep it direct and polite. Refined statement: "${userText}"`,
    Dating: `Good vibe. Keep it light, respectful, and playful. Your line: "${userText}"`
  };

  return templates[mode] || templates.Interview;
}

function speak(text) {
  if (!window.speechSynthesis) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

function processUserText(text) {
  latestText = text;
  liveTranscript.textContent = text;

  const suggestions = improveSentence(text);
  renderSuggestions(suggestions);

  const chosenLine = suggestions[0] || text;
  const reply = buildModeReply(chosenLine, selectedMode);
  aiReplyEl.textContent = reply;

  sessionEntries.push({
    original: text,
    improved: chosenLine,
    mode: selectedMode,
    timestamp: Date.now()
  });

  speak(reply);
}

function buildRecognition() {
  const instance = new SpeechRecognition();
  instance.lang = "en-US";
  instance.continuous = true;
  instance.interimResults = true;

  instance.onresult = (event) => {
    let interim = "";
    let finalText = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interim += transcript;
      }
    }

    liveTranscript.textContent = interim || finalText || "Listening...";

    if (finalText.trim()) {
      processUserText(finalText.trim());
    }
  };

  instance.onerror = (event) => {
    setStatus(`Error: ${event.error}`);
  };

  instance.onend = () => {
    if (!stopBtn.disabled) {
      try {
        instance.start();
      } catch (_err) {
        setStatus("Idle");
      }
    } else {
      setStatus("Idle");
    }
  };

  return instance;
}

function scoreSession() {
  if (!sessionEntries.length) {
    improvementTips.textContent = "Start a conversation first to generate feedback.";
    return;
  }

  const totalWords = sessionEntries
    .map((e) => e.original.split(/\s+/).length)
    .reduce((a, b) => a + b, 0);

  const avgWords = totalWords / sessionEntries.length;
  const grammar = Math.min(96, Math.round(60 + sessionEntries.length * 3));
  const fluency = Math.min(95, Math.round(55 + avgWords * 2));
  const confidence = Math.min(97, Math.round(58 + sessionEntries.length * 2 + avgWords));

  grammarScoreEl.textContent = grammar;
  fluencyScoreEl.textContent = fluency;
  confidenceScoreEl.textContent = confidence;

  const tips = [];
  if (grammar < 75) {
    tips.push("Use short complete sentences with subject + verb.");
  } else {
    tips.push("Great grammar control. Keep practicing advanced vocabulary.");
  }

  if (fluency < 75) {
    tips.push("Try fewer pauses and speak in 6-10 word chunks.");
  } else {
    tips.push("Your speaking flow is good. Focus on natural intonation.");
  }

  if (confidence < 75) {
    tips.push("Use strong openings like: 'I believe', 'I can', 'I will'.");
  } else {
    tips.push("Confident tone detected. Keep eye contact and steady pace.");
  }

  improvementTips.textContent = tips.join(" ");
}

if (!SpeechRecognition) {
  startBtn.disabled = true;
  stopBtn.disabled = true;
  setStatus("Browser not supported");
  liveTranscript.textContent = "Use Chrome/Edge for speech recognition support.";
} else {
  recognition = buildRecognition();
}

startBtn.addEventListener("click", () => {
  if (!recognition) {
    return;
  }

  sessionEntries = [];
  setStatus("Listening", true);
  startBtn.disabled = true;
  stopBtn.disabled = false;

  try {
    recognition.start();
  } catch (_err) {
    setStatus("Mic Busy");
  }
});

stopBtn.addEventListener("click", () => {
  if (!recognition) {
    return;
  }

  stopBtn.disabled = true;
  startBtn.disabled = false;
  recognition.stop();
  setStatus("Session Ended");
});

modeGrid.addEventListener("click", (event) => {
  const btn = event.target.closest(".mode-btn");
  if (!btn) {
    return;
  }

  [...modeGrid.querySelectorAll(".mode-btn")].forEach((node) => {
    node.classList.remove("active");
  });

  btn.classList.add("active");
  selectedMode = btn.dataset.mode;
  aiReplyEl.textContent = `Mode switched to ${selectedMode}. Start speaking whenever you're ready.`;
});

calcFeedbackBtn.addEventListener("click", scoreSession);
