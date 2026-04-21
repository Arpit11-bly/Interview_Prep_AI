const fillerWords = ["um", "uh", "like", "you know", "actually", "basically", "literally"];

const interviewQuestionBank = [
  "Tell me about yourself in 60 seconds.",
  "Why are you interested in this role?",
  "Describe one project where you solved a difficult problem.",
  "How do you prioritize tasks when deadlines collide?",
  "Share one mistake you made and what you learned from it.",
  "Do you have any questions for the interviewer?",
];

function normalizeSpacing(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function sentenceCase(text) {
  const clean = normalizeSpacing(text);
  if (!clean) return "";
  const withCapital = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(withCapital) ? withCapital : `${withCapital}.`;
}

function normalizeForCompare(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text, limit = 8) {
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "your", "you", "our", "are", "was", "were",
    "have", "has", "had", "will", "would", "could", "should", "about", "role", "team", "work", "experience",
    "years", "year", "using", "used", "need", "must", "job", "candidate", "skills", "skill", "plus", "good",
    "strong", "ability", "required", "preferred", "build", "building", "develop", "developer", "engineer",
    "responsible", "including", "across", "their", "they", "them", "through", "when", "where", "what", "which",
  ]);

  const matches = String(text || "").toLowerCase().match(/[a-z][a-z+#.\-/]{1,}/g) || [];
  const counts = new Map();

  matches.forEach((token) => {
    if (token.length < 2 || stopWords.has(token)) return;
    counts.set(token, (counts.get(token) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([token]) => token);
}

function formatKeywordList(keywords) {
  return keywords.length ? keywords.join(", ") : "";
}

function tokenSet(text) {
  return new Set(normalizeForCompare(text).split(" ").filter(Boolean));
}

function overlapRatio(a, b) {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (!setA.size || !setB.size) return 0;

  let common = 0;
  setA.forEach((token) => {
    if (setB.has(token)) common += 1;
  });

  return common / Math.min(setA.size, setB.size);
}

function uniqueByLower(items) {
  const map = new Map();
  items.forEach((item) => {
    const clean = String(item || "").trim();
    const key = clean.toLowerCase();
    if (clean && !map.has(key)) {
      map.set(key, clean);
    }
  });
  return [...map.values()];
}

function removeFillers(text) {
  let out = String(text || "");
  fillerWords.forEach((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
  });
  return normalizeSpacing(out);
}

function softGrammarFix(text) {
  return normalizeSpacing(
    String(text || "")
      .replace(/\bi\b/g, "I")
      .replace(/\bim\b/gi, "I am")
      .replace(/\bi'm\b/gi, "I am")
      .replace(/\bu\b/gi, "you")
      .replace(/\bwanna\b/gi, "want to")
      .replace(/\bgonna\b/gi, "going to")
      .replace(/\bdon't know\b/gi, "am not sure yet")
      .replace(/\bjob in your company\b/gi, "a role at your company")
  );
}

function modeSpecificRewrite(text) {
  return text;
}

function roleSpecificQuestion(role) {
  const value = String(role || "").toLowerCase();
  if (value.includes("frontend")) {
    return "How have you improved UI performance or accessibility in your projects?";
  }
  if (value.includes("backend")) {
    return "How do you design APIs for reliability and scalability?";
  }
  if (value.includes("data")) {
    return "How do you explain data insights to non-technical stakeholders?";
  }
  return "What unique value can you bring to this role from day one?";
}

function buildJdQuestion(interviewContext, historyLength = 0) {
  const role = interviewContext?.role || "this role";
  const jdKeywords = extractKeywords(interviewContext?.jd || "", 10);
  if (!jdKeywords.length) return "";

  const keyword = jdKeywords[historyLength % jdKeywords.length];
  const keywordList = formatKeywordList(jdKeywords.slice(0, 4));

  if (historyLength <= 0) {
    return `This JD highlights ${keywordList}. Tell me about a project where you used ${keyword} and the impact you created.`;
  }

  return `The JD emphasizes ${keyword}. Walk me through how you would apply ${keyword} in this ${role} role, including tradeoffs or decisions you would make.`;
}

function roleBasedPrompt(interviewContext) {
  const role = interviewContext?.role || "this role";
  const company = interviewContext?.company || "our company";
  const jdQuestion = buildJdQuestion(interviewContext, 0);
  const specialQuestion = roleSpecificQuestion(role);
  if (jdQuestion) {
    return `Mock interview for ${role} at ${company}. First question: ${jdQuestion}`;
  }
  return `Mock interview set for ${role} at ${company}. First question: ${interviewQuestionBank[0]} Bonus question later: ${specialQuestion}`;
}

function isNonAnswer(text) {
  const value = String(text || "").toLowerCase();
  const patterns = [
    "i don't know",
    "dont know",
    "i do not know",
    "i don't want to answer",
    "skip",
    "no idea",
    "can't answer",
    "cannot answer",
  ];
  return patterns.some((item) => value.includes(item));
}

function buildInterviewCoaching(answer) {
  const text = String(answer || "").trim();
  if (!text) {
    return "Please answer in 3-5 lines with your background, skills, and one measurable achievement.";
  }

  const words = text.split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();

  if (words.length < 12) {
    return "Good start. Expand your answer with education, core skills, and one project outcome.";
  }

  if ((lower.match(/\bi have\b/g) || []).length >= 3) {
    return "Avoid repeating 'I have'. Use a clear structure: introduction, strengths, and impact.";
  }

  if (!/\d/.test(text)) {
    return "Add one concrete result with numbers, like users impacted, marks, or project metrics.";
  }

  return "Strong attempt. Keep your answer concise and impact-focused.";
}

function nextQuestion(historyLength, interviewContext) {
  const jdQuestion = buildJdQuestion(interviewContext, historyLength);
  if (historyLength <= 0) return roleBasedPrompt(interviewContext);
  if (jdQuestion && historyLength <= 3) return jdQuestion;
  const index = Math.min(historyLength, interviewQuestionBank.length - 1);
  return interviewQuestionBank[index];
}

function buildModeOpening(interviewContext) {
  if (!interviewContext?.role && !interviewContext?.company) {
    return "Set your target role and company, then I will start a focused mock interview.";
  }
  return roleBasedPrompt(interviewContext);
}

function buildModeReply(improvedUserText, interviewContext, historyLength) {
  if (isNonAnswer(improvedUserText)) {
    return `Your answer did not address the question clearly. Try again with a direct and role-specific answer. Next question: ${nextQuestion(historyLength, interviewContext)}`;
  }
  const coach = buildInterviewCoaching(improvedUserText);
  return `${coach} Next question: ${nextQuestion(historyLength, interviewContext)}`;
}

function improveSentence(input, options = {}) {
  const cleaned = normalizeSpacing(input);
  if (!cleaned) return [];

  const grammar = sentenceCase(softGrammarFix(cleaned));
  const concise = sentenceCase(removeFillers(softGrammarFix(cleaned)));
  const modeRewrite = sentenceCase(modeSpecificRewrite(softGrammarFix(cleaned)));
  const confidenceOpeners = ["I can contribute by", "My key strength is", "I am confident in"];
  const opener = confidenceOpeners[cleaned.length % confidenceOpeners.length];
  const confident = sentenceCase(`${opener} ${removeFillers(softGrammarFix(cleaned)).toLowerCase()}`);

  return uniqueByLower([grammar, concise, modeRewrite, confident]).slice(0, 3);
}

function fallbackTipsFromQuestion(questionText) {
  const question = String(questionText || "").toLowerCase();
  if (question.includes("tell me about yourself")) {
    return [
      "Start with your current role or education.",
      "Mention two strengths relevant to the role.",
      "Add one project with measurable impact.",
      "Close with why this role fits you.",
    ];
  }

  if (question.includes("why") && question.includes("role")) {
    return [
      "Connect your skills directly to role needs.",
      "Mention one example that proves fit.",
      "Explain your motivation for joining.",
      "Keep your answer concise and specific.",
    ];
  }

  return [
    "Answer directly in the first sentence.",
    "Include one concrete example.",
    "Mention measurable impact if possible.",
    "End with confidence and clarity.",
  ];
}

function countMatches(text, pattern) {
  const found = String(text || "").match(pattern);
  return found ? found.length : 0;
}

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function average(items) {
  return items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0;
}

function blendScore(aiValue, fallbackValue) {
  const aiNumber = Number(aiValue);
  if (!Number.isFinite(aiNumber)) return fallbackValue;
  return clampScore((aiNumber * 0.35) + (fallbackValue * 0.65), 0, 100);
}

function scoreSession(entries) {
  if (!entries.length) {
    return {
      grammar: 0,
      fluency: 0,
      confidence: 0,
      tips: "Start a conversation first to generate feedback.",
      report: null,
    };
  }

  const originalText = entries.map((entry) => entry.original).join(" ");
  const totalWords = countMatches(originalText, /\b[\w']+\b/g);
  const totalSentences = Math.max(1, countMatches(originalText, /[.!?]/g));
  const avgWordsPerSentence = Math.max(1, Math.round((totalWords / totalSentences) * 10) / 10);
  const avgWordsPerAnswer = totalWords / entries.length;
  const answerLengths = entries.map((entry) => countMatches(entry.original, /\b[\w']+\b/g));

  const fillerCount = fillerWords
    .map((word) => countMatches(originalText, new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")))
    .reduce((sum, count) => sum + count, 0);

  const weakGrammarSignals = countMatches(originalText, /\bi\b/g) + countMatches(originalText, /\bu\b/gi);
  const repeatPenalty = Math.max(0, entries.length - uniqueByLower(entries.map((entry) => entry.original)).length);
  const punctuationCoverage = entries.filter((entry) => /[.!?]/.test(entry.original || "")).length / entries.length;
  const jdKeywords = extractKeywords(entries[0]?.interviewContext?.jd || "", 12);
  const roleKeywords = extractKeywords(entries[0]?.interviewContext?.role || "", 4);
  const targetKeywords = uniqueByLower([...jdKeywords, ...roleKeywords]);
  const relevanceRatios = entries.map((entry) => {
    const answer = String(entry.original || "");
    if (!targetKeywords.length) return 0.55;
    const hitCount = targetKeywords.filter((keyword) => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(answer)).length;
    return hitCount / targetKeywords.length;
  });
  const relevanceScore = average(relevanceRatios);
  const quantifiedAnswers = entries.filter((entry) => /\d/.test(entry.original || "")).length;
  const actionVerbAnswers = entries.filter((entry) => /\b(built|improved|led|created|designed|optimized|implemented|delivered|reduced|increased|scaled|owned|launched)\b/i.test(entry.original || "")).length;
  const technicalTermAnswers = entries.filter((entry) => /\b(api|react|node|database|system|design|performance|testing|architecture|scalability|algorithm|state|component|backend|frontend|microservice|cache|redis|sql|nosql|docker|kubernetes|javascript|typescript)\b/i.test(entry.original || "")).length;
  const shortAnswerPenalty = answerLengths.filter((count) => count < 12).length;
  const longAnswerBonus = answerLengths.filter((count) => count >= 28).length;

  const grammar = clampScore(
    62 +
      punctuationCoverage * 14 +
      Math.min(10, avgWordsPerSentence * 0.9) +
      longAnswerBonus * 1.2 -
      weakGrammarSignals * 4 -
      repeatPenalty * 3 -
      Math.max(0, fillerCount - entries.length) * 1.2,
    42,
    97
  );

  const fluency = clampScore(
    58 +
      Math.min(12, avgWordsPerSentence) +
      Math.min(8, avgWordsPerAnswer / 6) +
      longAnswerBonus -
      fillerCount * 1.8 -
      shortAnswerPenalty * 2.5,
    40,
    96
  );

  const confidence = clampScore(
    54 +
      actionVerbAnswers * 4 +
      quantifiedAnswers * 3 +
      relevanceScore * 18 +
      Math.min(8, entries.length * 1.4) -
      fillerCount * 1.3 -
      shortAnswerPenalty * 2,
    38,
    97
  );

  const technicalKnowledge = clampScore(
    46 +
      technicalTermAnswers * 5 +
      quantifiedAnswers * 2 +
      relevanceScore * 28 +
      longAnswerBonus * 1.5 -
      shortAnswerPenalty * 1.5,
    35,
    98
  );

  const strengths = [];
  const improvements = [];

  if (grammar >= 78) strengths.push("Sentence structure is mostly clear and understandable.");
  else improvements.push("Use full sentences with a clear subject and verb.");

  if (fluency >= 78) strengths.push("Flow is stable with decent sentence length.");
  else improvements.push("Reduce filler words and pause between ideas, not inside phrases.");

  if (confidence >= 78) strengths.push("Tone sounds assertive and purposeful.");
  else improvements.push("Start key points with confident openers like 'I can', 'I have', 'I will'.");

  if (technicalKnowledge >= 78) strengths.push("Your answers show solid technical understanding with relevant terminology.");
  else improvements.push("Explain your technical decisions with one concrete example and the reason behind it.");

  if (!strengths.length) strengths.push("You stayed engaged throughout the conversation.");
  if (!improvements.length) improvements.push("Push for richer vocabulary and specific examples for stronger impact.");

  const tips = `${improvements[0]} ${improvements[1] || ""}`.trim();

  return {
    grammar,
    fluency,
    confidence,
    technicalKnowledge,
    tips,
    report: {
      strengths,
      improvements,
      summary: `You completed ${entries.length} interview responses with ${Math.round(relevanceScore * 100)}% JD/role alignment. Focus on precision, technical depth, and confident delivery to move to the next level.`,
    },
  };
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

  return { relevance, structure, vocabulary, consistency };
}

function buildConversation(entries) {
  return entries.map((entry) => ({
    aiQuestion: entry.prompt || "",
    user: entry.original || "",
    betterAnswer: entry.improved || "",
    aiReply: entry.aiReply || "",
  }));
}

function safeParseJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_error) {
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (!objectMatch) return null;

    try {
      return JSON.parse(objectMatch[0]);
    } catch (__error) {
      return null;
    }
  }
}

async function callGroq(systemPrompt, userPayload) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Groq request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function generateOpening(payload) {
  const { interviewContext } = payload;
  const fallbackOpening = buildModeOpening(interviewContext);

  try {
    const systemPrompt = [
      "You are an English communication coach.",
      "Return ONLY valid JSON in format: {\"opening\":string}.",
      "Opening should be natural and non-repetitive.",
      "If mode is Interview, ask one clear first interview question.",
      "If interviewContext.jd exists, first question must be directly tied to that JD.",
      "If customConversationType exists, opener must follow that scenario.",
    ].join(" ");

    const text = await callGroq(systemPrompt, payload);
    const parsed = safeParseJson(text);
    if (parsed?.opening) {
      return { opening: String(parsed.opening).trim(), source: "ai" };
    }
  } catch (_error) {
    // Fallback below.
  }

  return { opening: fallbackOpening, source: "fallback" };
}

async function generateTurn(payload) {
  const { userText, interviewContext, history } = payload;
  const localSuggestions = improveSentence(userText);
  const fallbackReply = buildModeReply(userText, interviewContext, Array.isArray(history) ? history.length + 1 : 1);

  try {
    const systemPrompt = [
      "You are an English communication coach.",
      "Return ONLY valid JSON.",
      "Format: {\"reply\":string,\"suggestions\":[string,string,string]}",
      "Suggestions must be natural, concise, and not copy the user's sentence.",
      "If interviewContext.jd is provided, make the interview follow-up role-specific and directly grounded in the JD keywords.",
      "In interview mode, always ask exactly one next question.",
    ].join(" ");

    const text = await callGroq(systemPrompt, payload);
    const parsed = safeParseJson(text);

    if (parsed?.reply && Array.isArray(parsed?.suggestions)) {
      const suggestions = uniqueByLower(parsed.suggestions)
        .filter((item) => overlapRatio(item, userText) < 0.9)
        .slice(0, 3);

      return {
        reply: String(parsed.reply).trim(),
        suggestions: suggestions.length ? suggestions : localSuggestions,
        source: "ai",
      };
    }
  } catch (_error) {
    // Fallback below.
  }

  return {
    reply: fallbackReply,
    suggestions: localSuggestions.length ? localSuggestions : [sentenceCase(userText)],
    source: "fallback",
  };
}

async function generateAnswerTips(payload) {
  const fallback = fallbackTipsFromQuestion(payload.question);

  try {
    const systemPrompt = [
      "You are an expert communication coach.",
      "Return ONLY valid JSON in format: {\"tips\":[string,string,string,string]}.",
      "Tips must be concise, actionable, and role-aware.",
    ].join(" ");

    const text = await callGroq(systemPrompt, payload);
    const parsed = safeParseJson(text);
    if (Array.isArray(parsed?.tips)) {
      return {
        tips: uniqueByLower(parsed.tips).slice(0, 4),
        source: "ai",
      };
    }
  } catch (_error) {
    // Fallback below.
  }

  return { tips: fallback, source: "fallback" };
}

async function generateReport(payload) {
  const interviewContext = payload.interviewContext || {};
  const entries = (Array.isArray(payload.entries) ? payload.entries : []).map((entry) => ({
    ...entry,
    interviewContext,
  }));
  const localScores = scoreSession(entries);
  let reportPayload = {
    grammar: localScores.grammar,
    fluency: localScores.fluency,
    confidence: localScores.confidence,
    technicalKnowledge: localScores.technicalKnowledge,
    tips: localScores.tips,
    report: localScores.report || {},
    source: "fallback",
  };

  try {
    const systemPrompt = [
      "You are an expert communication evaluator.",
      "Return ONLY valid JSON.",
      "Format:",
      "{\"grammar\":number,\"fluency\":number,\"confidence\":number,\"technicalKnowledge\":number,\"tips\":string,\"report\":{\"summary\":string,\"strengths\":[string],\"improvements\":[string]}}",
    ].join(" ");

    const text = await callGroq(systemPrompt, payload);
    const parsed = safeParseJson(text);
    if (parsed?.report) {
      reportPayload = {
        grammar: blendScore(parsed.grammar, localScores.grammar),
        fluency: blendScore(parsed.fluency, localScores.fluency),
        confidence: blendScore(parsed.confidence, localScores.confidence),
        technicalKnowledge: blendScore(parsed.technicalKnowledge, localScores.technicalKnowledge),
        tips: String(parsed.tips || localScores.tips),
        report: {
          summary: String(parsed.report.summary || localScores.report?.summary || ""),
          strengths: Array.isArray(parsed.report.strengths) ? parsed.report.strengths : localScores.report?.strengths || [],
          improvements: Array.isArray(parsed.report.improvements)
            ? parsed.report.improvements
            : localScores.report?.improvements || [],
        },
        source: "ai",
      };
    }
  } catch (_error) {
    // Fallback below.
  }

  return {
    ...reportPayload,
    performance: derivePerformance(entries, reportPayload),
    conversation: buildConversation(entries),
  };
}

module.exports = {
  generateOpening,
  generateTurn,
  generateAnswerTips,
  generateReport,
};
