import { improveSentence, renderSuggestions } from "./suggestion-engine.js";
import {
  createModeState,
  updateInterviewContext,
  getModeOpening,
  buildModeReply
} from "./mode-engine.js";
import { scoreSession } from "./feedback-engine.js";
import { requestAiTurn, requestAiOpening, requestAnswerTips, requestDetailedReport } from "./api-client.js";
import { saveSessionReport } from "./auth-client.js";

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const pttBtn = document.getElementById("pttBtn");
const micMode = document.getElementById("micMode");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");
const clearAnswerBtn = document.getElementById("clearAnswerBtn");
const refineTranscriptBtn = document.getElementById("refineTranscriptBtn");
const speechLang = document.getElementById("speechLang");
const answerInput = document.getElementById("answerInput");
const liveTranscript = document.getElementById("liveTranscript");
const suggestionsWrap = document.getElementById("suggestions");
const aiReplyEl = document.getElementById("aiReply");
const aiSourceEl = document.getElementById("aiSource");
const statusPill = document.getElementById("statusPill");
const modeGrid = document.getElementById("modeGrid");
const grammarScoreEl = document.getElementById("grammarScore");
const fluencyScoreEl = document.getElementById("fluencyScore");
const confidenceScoreEl = document.getElementById("confidenceScore");
const improvementTips = document.getElementById("improvementTips");
const detailedReport = document.getElementById("detailedReport");
const setInterviewBtn = document.getElementById("setInterviewBtn");
const interviewRole = document.getElementById("interviewRole");
const interviewCompany = document.getElementById("interviewCompany");
const interviewJD = document.getElementById("interviewJD");
const customConversationType = document.getElementById("customConversationType");
const interviewSetup = document.getElementById("interviewSetup");
const conversationLog = document.getElementById("conversationLog");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let selectedMode = "Interview";
let sessionEntries = [];
let sessionActive = false;
let recentSuggestionHistory = [];
let isSubmitting = false;
let lastFinalChunk = "";
let isRecognizing = false;
let isHoldingToTalk = false;
let micInteractionMode = "hold";
const modeState = createModeState();

function setStatus(label, listening = false) {
  statusPill.textContent = label;
  statusPill.classList.toggle("listening", listening);
}

function updatePttUi() {
  if (!pttBtn) return;
  if (micInteractionMode === "tap") {
    pttBtn.textContent = isRecognizing ? "Tap To Stop" : "Tap To Talk";
    return;
  }
  pttBtn.textContent = "Hold To Talk";
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.lang = speechLang?.value || "en-IN";
  window.speechSynthesis.speak(utterance);
}

function appendChat(role, text) {
  const item = document.createElement("div");
  item.className = `chat-row ${role}`;
  item.textContent = text;
  conversationLog.appendChild(item);
  conversationLog.scrollTop = conversationLog.scrollHeight;
}

async function openConversationByMode() {
  let opening = getModeOpening(selectedMode, modeState);
  let source = "Local opener";

  try {
    const apiResult = await requestAiOpening({
      mode: selectedMode,
      customConversationType: customConversationType?.value?.trim() || "",
      interviewContext: {
        role: modeState.interview.role,
        company: modeState.interview.company,
        jd: interviewJD?.value?.trim() || ""
      },
      history: sessionEntries.slice(-8).map((entry) => ({
        user: entry.original,
        assistant: entry.aiReply,
        mode: entry.mode
      }))
    });

    if (apiResult?.opening) {
      opening = String(apiResult.opening).trim();
      source = "Groq";
    }
  } catch (_err) {
    source = "Local opener (Groq unavailable)";
  }

  aiReplyEl.textContent = opening;
  aiSourceEl.textContent = `Source: ${source}`;
  appendChat("ai", opening);
  speak(opening);
  await loadAnswerTips(opening);
}

function addSuggestionHistory(items) {
  items.forEach((item) => recentSuggestionHistory.push(item));
  recentSuggestionHistory = recentSuggestionHistory.slice(-15);
}

function sanitizeSuggestions(items, fallbackText, userText) {
  const cleaned = (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  const unique = [];
  const userLower = String(userText || "").trim().toLowerCase();
  cleaned.forEach((item) => {
    const lower = item.toLowerCase();
    if (
      lower !== userLower &&
      !unique.some((u) => u.toLowerCase() === lower) &&
      !recentSuggestionHistory.some((s) => s.toLowerCase() === lower)
    ) {
      unique.push(item);
    }
  });

  if (!unique.length && fallbackText) {
    unique.push(fallbackText);
  }

  return unique.slice(0, 3);
}

function normalizeTranscript(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function chooseBestAlternative(result) {
  let best = result[0]?.transcript || "";
  let bestScore = Number(result[0]?.confidence || 0);

  for (let i = 1; i < result.length; i += 1) {
    const altText = result[i]?.transcript || "";
    const altConfidence = Number(result[i]?.confidence || 0);
    if (altConfidence > bestScore && altText) {
      best = altText;
      bestScore = altConfidence;
    }
  }
  return normalizeTranscript(best);
}

function appendWithoutDup(existing, chunk) {
  const base = normalizeTranscript(existing);
  const add = normalizeTranscript(chunk);
  if (!add) return base;
  if (!base) return add;
  if (base.toLowerCase().endsWith(add.toLowerCase())) return base;
  if (add.toLowerCase().startsWith(base.toLowerCase())) return add;

  const baseWords = base.split(" ");
  const addWords = add.split(" ");
  const maxOverlap = Math.min(baseWords.length, addWords.length, 8);

  let overlap = 0;
  for (let len = maxOverlap; len >= 1; len -= 1) {
    const baseEnd = baseWords.slice(-len).join(" ").toLowerCase();
    const addStart = addWords.slice(0, len).join(" ").toLowerCase();
    if (baseEnd === addStart) {
      overlap = len;
      break;
    }
  }

  return normalizeTranscript(`${base} ${addWords.slice(overlap).join(" ")}`);
}

function refineTranscriptText(text) {
  return normalizeTranscript(text)
    .replace(/\bi\b/g, "I")
    .replace(/\bim\b/gi, "I am")
    .replace(/\bu\b/gi, "you")
    .replace(/\bgonna\b/gi, "going to")
    .replace(/\bwanna\b/gi, "want to");
}

function normalizeForCompare(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isReplyRepeated(reply) {
  const current = normalizeForCompare(reply);
  if (!current) return false;
  const lastAssistantReplies = sessionEntries
    .slice(-6)
    .map((entry) => normalizeForCompare(entry.aiReply))
    .filter(Boolean);
  return lastAssistantReplies.includes(current);
}

function extractQuestionForTips(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  const matches = value.match(/[^.?!]*\?/g);
  if (matches && matches.length) {
    return matches[matches.length - 1].trim();
  }
  return value;
}

function fallbackTipsFromQuestion(question) {
  const q = question.toLowerCase();
  if (q.includes("tell me about yourself")) {
    return [
      "Start with current role or education and your core domain.",
      "Mention 2 key strengths aligned with this role.",
      "Add one project with measurable impact.",
      "Close with why this role fits your goals."
    ];
  }
  if (q.includes("why") && q.includes("role")) {
    return [
      "Connect your skills directly to role requirements.",
      "Mention one past example that proves fit.",
      "Explain growth and long-term motivation.",
      "Keep answer focused and role-specific."
    ];
  }
  return [
    "Answer directly in the first sentence.",
    "Include one concrete example.",
    "Add measurable impact if possible.",
    "End with confidence and clarity."
  ];
}

async function loadAnswerTips(questionText) {
  const question = extractQuestionForTips(questionText);

  let tips = fallbackTipsFromQuestion(question);
  try {
    const apiResult = await requestAnswerTips({
      mode: selectedMode,
      question,
      customConversationType: customConversationType?.value?.trim() || "",
      interviewContext: {
        role: modeState.interview.role,
        company: modeState.interview.company,
        jd: interviewJD?.value?.trim() || ""
      },
      history: sessionEntries.slice(-8).map((entry) => ({
        user: entry.original,
        assistant: entry.aiReply,
        mode: entry.mode
      }))
    });

    const aiTips = Array.isArray(apiResult?.tips) ? apiResult.tips : [];
    const clean = aiTips.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 4);
    if (clean.length) tips = clean;
  } catch (_err) {
    // keep fallback tips
  }

  renderSuggestions(suggestionsWrap, tips, (picked) => {
    const combined = answerInput.value
      ? `${answerInput.value}\n- ${picked}`
      : `- ${picked}`;
    answerInput.value = combined;
    liveTranscript.textContent = "Tip added to your answer draft.";
  });
}

function derivePerformance(entries, scores) {
  const totalWords = entries
    .map((entry) => String(entry.original || "").split(/\s+/).filter(Boolean).length)
    .reduce((sum, count) => sum + count, 0);
  const avgLen = entries.length ? totalWords / entries.length : 0;
  const relevance = Math.max(55, Math.min(98, Math.round(62 + entries.length * 4)));
  const structure = Math.max(50, Math.min(98, Math.round(56 + avgLen * 3)));
  const vocabulary = Math.max(52, Math.min(97, Math.round((scores.grammar + scores.fluency) / 2)));
  const consistency = Math.max(48, Math.min(97, Math.round((scores.confidence + relevance) / 2)));

  return {
    relevance,
    structure,
    vocabulary,
    consistency
  };
}

function formatConversationHtml(conversation) {
  if (!conversation.length) return "<p>No conversation turns available.</p>";
  return conversation
    .map((turn, index) => {
      return `<p><strong>Turn ${index + 1}</strong><br><strong>AI Question/Prompt:</strong> ${turn.aiQuestion || "-"}<br><strong>Your Answer:</strong> ${turn.user || "-"}<br><strong>AI Better Answer:</strong> ${turn.betterAnswer || "-"}</p>`;
    })
    .join("");
}

function renderDetailedReport(reportData) {
  if (!reportData) {
    detailedReport.textContent = "End session to auto-generate report.";
    return;
  }

  const strengths = (reportData.strengths || []).map((point) => `<p>- ${point}</p>`).join("");
  const improvements = (reportData.improvements || []).map((point) => `<p>- ${point}</p>`).join("");
  const conversationHtml = formatConversationHtml(reportData.conversation || []);
  const perf = reportData.performance || {};

  detailedReport.innerHTML = `
    <p><strong>Session Summary:</strong> ${reportData.summary || "No summary available."}</p>
    <p><strong>Scores:</strong> Grammar ${reportData.scores?.grammar ?? 0} | Fluency ${reportData.scores?.fluency ?? 0} | Confidence ${reportData.scores?.confidence ?? 0}</p>
    <p><strong>Performance Parameters:</strong> Relevance ${perf.relevance ?? 0} | Structure ${perf.structure ?? 0} | Vocabulary ${perf.vocabulary ?? 0} | Consistency ${perf.consistency ?? 0}</p>
    <p><strong>Tips:</strong> ${reportData.tips || "-"}</p>
    <p><strong>Strengths</strong></p>
    ${strengths || "<p>- Keep building consistency across answers.</p>"}
    <p><strong>Areas To Improve</strong></p>
    ${improvements || "<p>- Add measurable examples and clear structure.</p>"}
    <p><strong>Conversation + Better Answers</strong></p>
    ${conversationHtml}
  `;
}

async function buildSessionReport() {
  let result = scoreSession(sessionEntries);

  try {
    setStatus("Analyzing", false);
    const apiResult = await requestDetailedReport({
      mode: selectedMode,
      customConversationType: customConversationType?.value?.trim() || "",
      interviewContext: {
        role: modeState.interview.role,
        company: modeState.interview.company,
        jd: interviewJD?.value?.trim() || ""
      },
      entries: sessionEntries
    });

    result = {
      grammar: Number(apiResult.grammar ?? result.grammar),
      fluency: Number(apiResult.fluency ?? result.fluency),
      confidence: Number(apiResult.confidence ?? result.confidence),
      tips: String(apiResult.tips || result.tips),
      report: apiResult.report || result.report
    };
  } catch (_err) {
    // local fallback already in result
  }

  const reportCore = result.report || {};
  const performance = derivePerformance(sessionEntries, result);
  const conversation = sessionEntries.map((entry) => ({
    aiQuestion: entry.prompt || "",
    user: entry.original || "",
    betterAnswer: entry.improved || "",
    aiReply: entry.aiReply || ""
  }));

  const reportData = {
    id: `rep_${Date.now()}`,
    timestamp: Date.now(),
    mode: selectedMode,
    customConversationType: customConversationType?.value?.trim() || "",
    interviewContext: {
      role: modeState.interview.role,
      company: modeState.interview.company,
      jd: interviewJD?.value?.trim() || ""
    },
    summary: reportCore.summary || `You completed ${sessionEntries.length} turns in ${selectedMode} mode.`,
    tips: result.tips,
    strengths: reportCore.strengths || [],
    improvements: reportCore.improvements || [],
    scores: {
      grammar: result.grammar,
      fluency: result.fluency,
      confidence: result.confidence
    },
    performance,
    conversation
  };

  grammarScoreEl.textContent = result.grammar;
  fluencyScoreEl.textContent = result.fluency;
  confidenceScoreEl.textContent = result.confidence;
  improvementTips.textContent = result.tips;
  renderDetailedReport(reportData);
  await saveSessionReport(reportData).catch(() => {
    // keep report visible even if save API fails
  });
}

async function processSubmittedAnswer(rawText) {
  const text = rawText.trim();
  if (!text || isSubmitting) return;
  const askedPrompt = String(aiReplyEl.textContent || "").trim();

  isSubmitting = true;
  submitAnswerBtn.disabled = true;

  liveTranscript.textContent = text;
  appendChat("user", text);

  const localSuggestions = improveSentence(text, {
    mode: selectedMode,
    recentSuggestions: recentSuggestionHistory
  });

  let suggestions = localSuggestions;
  let improvedCandidate = localSuggestions[0] || text;
  let aiReply = "";
  let aiSource = "Local fallback";
  const localReply = () => buildModeReply(selectedMode, text, modeState);

  try {
    setStatus("Thinking", true);
    const apiResult = await requestAiTurn({
      mode: selectedMode,
      userText: text,
      customConversationType: customConversationType?.value?.trim() || "",
      interviewContext: {
        role: modeState.interview.role,
        company: modeState.interview.company,
        jd: interviewJD?.value?.trim() || ""
      },
      history: sessionEntries.slice(-8).map((entry) => ({
        user: entry.original,
        improved: entry.improved,
        assistant: entry.aiReply,
        mode: entry.mode
      }))
    });

    suggestions = sanitizeSuggestions(apiResult.suggestions, localSuggestions[0] || text, text);
    improvedCandidate = suggestions[0] || improvedCandidate;
    aiReply = String(apiResult.reply || "").trim();
    aiSource = "Groq";
  } catch (err) {
    suggestions = sanitizeSuggestions(localSuggestions, text, text);
    improvedCandidate = suggestions[0] || improvedCandidate;
    setStatus("Local coach mode", false);
    aiReply = "I could not reach the Groq model right now. Please retry in a moment or restart the local server.";
    const reason = String(err?.message || "API unavailable").slice(0, 80);
    aiSource = `Local fallback (${reason})`;
  }

  if (!aiReply) {
    aiReply = localReply();
    aiSource = "Local fallback";
  }

  if (isReplyRepeated(aiReply)) {
    aiReply = localReply();
    aiSource = "Local anti-repeat";
  }

  addSuggestionHistory(suggestions);
  const improved = improvedCandidate;
  aiReplyEl.textContent = aiReply;
  aiSourceEl.textContent = `Source: ${aiSource}`;
  appendChat("ai", aiReply);

  sessionEntries.push({
    prompt: askedPrompt,
    original: text,
    improved,
    aiReply,
    mode: selectedMode,
    timestamp: Date.now()
  });

  answerInput.value = "";
  speak(aiReply);
  await loadAnswerTips(aiReply);

  isSubmitting = false;
  submitAnswerBtn.disabled = !sessionActive;
  setStatus(sessionActive ? "Ready" : "Idle", false);
}

function buildRecognition() {
  const instance = new SpeechRecognition();
  instance.lang = speechLang?.value || "en-IN";
  instance.continuous = true;
  instance.interimResults = true;
  instance.maxAlternatives = 3;

  instance.onresult = (event) => {
    let interim = "";
    let finalText = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const picked = chooseBestAlternative(event.results[i]);
      if (event.results[i].isFinal) {
        finalText = appendWithoutDup(finalText, picked);
      } else {
        interim = appendWithoutDup(interim, picked);
      }
    }

    if (interim) liveTranscript.textContent = interim;

    if (finalText.trim()) {
      const safeFinal = finalText.toLowerCase() === lastFinalChunk.toLowerCase() ? "" : finalText;
      lastFinalChunk = finalText;
      const merged = appendWithoutDup(answerInput.value, safeFinal);
      answerInput.value = merged;
      liveTranscript.textContent = merged;
    }
  };

  instance.onerror = (event) => setStatus(`Error: ${event.error}`);

  instance.onend = () => {
    isRecognizing = false;
    updatePttUi();
    setStatus(sessionActive ? "Ready" : "Idle", false);
  };

  return instance;
}

function startRecognitionSafe() {
  if (!recognition || isRecognizing) return;
  try {
    recognition.lang = speechLang?.value || "en-IN";
    recognition.start();
    isRecognizing = true;
    updatePttUi();
    setStatus("Listening", true);
  } catch (_err) {
    setStatus("Mic Busy", false);
  }
}

function stopRecognitionSafe() {
  if (!recognition || !isRecognizing) return;
  recognition.stop();
}

function toggleInterviewSetup() {
  interviewSetup.style.display = selectedMode === "Interview" ? "block" : "none";
}

function clearSessionUi() {
  conversationLog.innerHTML = "";
  liveTranscript.textContent = "Waiting for input...";
  answerInput.value = "";
  lastFinalChunk = "";
  if (selectedMode !== "Interview") {
    interviewJD.value = "";
  }
  renderSuggestions(suggestionsWrap, [], () => {});
  renderDetailedReport(null);
}

function clearConversationAfterSession() {
  conversationLog.innerHTML = "";
  liveTranscript.textContent = "Session ended. Start a new one when ready.";
  answerInput.value = "";
  lastFinalChunk = "";
  renderSuggestions(suggestionsWrap, [], () => {});
}

if (!SpeechRecognition) {
  startBtn.disabled = true;
  stopBtn.disabled = true;
  setStatus("Browser not supported");
  liveTranscript.textContent = "Use Chrome/Edge for speech recognition support.";
} else {
  recognition = buildRecognition();
}

setInterviewBtn.addEventListener("click", () => {
  const opening = updateInterviewContext(modeState, interviewRole.value, interviewCompany.value);
  aiReplyEl.textContent = opening;
  aiSourceEl.textContent = "Source: Local setup";
  appendChat("ai", opening);
  speak(opening);
  loadAnswerTips(opening);
});

startBtn.addEventListener("click", async () => {
  if (!recognition) return;

  sessionEntries = [];
  recentSuggestionHistory = [];
  sessionActive = true;
  clearSessionUi();

  startBtn.disabled = true;
  stopBtn.disabled = false;
  pttBtn.disabled = false;
  submitAnswerBtn.disabled = false;
  updatePttUi();

  await openConversationByMode();
  setStatus("Ready", false);
});

stopBtn.addEventListener("click", async () => {
  if (!recognition) return;

  sessionActive = false;
  stopBtn.disabled = true;
  startBtn.disabled = false;
  pttBtn.disabled = true;
  submitAnswerBtn.disabled = true;
  isHoldingToTalk = false;
  stopRecognitionSafe();
  updatePttUi();

  if (sessionEntries.length) {
    await buildSessionReport();
    clearConversationAfterSession();
  } else {
    renderDetailedReport(null);
    improvementTips.textContent = "No responses captured in this session.";
  }

  setStatus("Session Ended", false);
});

submitAnswerBtn.addEventListener("click", async () => {
  if (!sessionActive) {
    aiReplyEl.textContent = "Start session first, then submit your answer.";
    return;
  }
  await processSubmittedAnswer(answerInput.value);
});

clearAnswerBtn.addEventListener("click", () => {
  answerInput.value = "";
  lastFinalChunk = "";
  liveTranscript.textContent = "Answer cleared. Speak or type again.";
});

refineTranscriptBtn.addEventListener("click", () => {
  const refined = refineTranscriptText(answerInput.value);
  answerInput.value = refined;
  liveTranscript.textContent = refined || "Transcript refined.";
});

speechLang.addEventListener("change", () => {
  if (recognition) {
    recognition.lang = speechLang.value;
  }
  setStatus(sessionActive ? "Ready" : "Idle", false);
});

micMode.addEventListener("change", () => {
  micInteractionMode = micMode.value === "tap" ? "tap" : "hold";
  isHoldingToTalk = false;
  if (isRecognizing) {
    stopRecognitionSafe();
  }
  updatePttUi();
  setStatus(sessionActive ? "Ready" : "Idle", false);
});

pttBtn.addEventListener("pointerdown", () => {
  if (micInteractionMode !== "hold") return;
  if (!sessionActive) {
    aiReplyEl.textContent = "Start session first, then use Hold To Talk.";
    return;
  }
  isHoldingToTalk = true;
  startRecognitionSafe();
});

pttBtn.addEventListener("pointerup", () => {
  if (micInteractionMode !== "hold") return;
  isHoldingToTalk = false;
  stopRecognitionSafe();
});

pttBtn.addEventListener("pointerleave", () => {
  if (micInteractionMode !== "hold") return;
  if (!isHoldingToTalk) return;
  isHoldingToTalk = false;
  stopRecognitionSafe();
});

pttBtn.addEventListener("pointercancel", () => {
  if (micInteractionMode !== "hold") return;
  isHoldingToTalk = false;
  stopRecognitionSafe();
});

pttBtn.addEventListener("click", () => {
  if (micInteractionMode !== "tap") return;
  if (!sessionActive) {
    aiReplyEl.textContent = "Start session first, then use Tap To Talk.";
    return;
  }
  if (isRecognizing) {
    stopRecognitionSafe();
  } else {
    startRecognitionSafe();
  }
});

answerInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    await processSubmittedAnswer(answerInput.value);
  }
});

modeGrid.addEventListener("click", (event) => {
  const btn = event.target.closest(".mode-btn");
  if (!btn) return;

  [...modeGrid.querySelectorAll(".mode-btn")].forEach((node) => node.classList.remove("active"));
  btn.classList.add("active");

  selectedMode = btn.dataset.mode;
  toggleInterviewSetup();

  const modeText = `Mode switched to ${selectedMode}. Press Start Listening to begin.`;
  aiReplyEl.textContent = modeText;
  aiSourceEl.textContent = "Source: Mode switch";
  appendChat("ai", modeText);
  renderSuggestions(suggestionsWrap, [], () => {});
});

toggleInterviewSetup();
submitAnswerBtn.disabled = true;
pttBtn.disabled = true;
micInteractionMode = micMode?.value === "tap" ? "tap" : "hold";
updatePttUi();
renderSuggestions(suggestionsWrap, [], () => {});
renderDetailedReport(null);
improvementTips.textContent = "Click End Session to auto-generate report and save it to your profile.";
