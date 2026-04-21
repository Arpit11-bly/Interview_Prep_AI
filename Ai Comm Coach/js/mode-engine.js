const interviewQuestionBank = [
  "Tell me about yourself in 60 seconds.",
  "Why are you interested in this role?",
  "Describe one project where you solved a difficult problem.",
  "How do you prioritize tasks when deadlines collide?",
  "Share one mistake you made and what you learned from it.",
  "Do you have any questions for the interviewer?"
];

const coachingLines = [
  "Strong attempt. Add one concrete result or number.",
  "Good structure. Keep your answer focused on impact.",
  "Nice clarity. Use fewer filler words for a sharper answer.",
  "Good confidence. Add a quick real example to strengthen it."
];

const casualPrompts = [
  "Nice. What do you enjoy doing after work or college?",
  "Cool. What is something new you learned recently?",
  "Interesting. If you had a free weekend, what would you do?",
  "That sounds good. What kind of people energize you in conversation?"
];

function isNonAnswer(text) {
  const value = String(text || "").toLowerCase();
  const patterns = [
    "i don't know",
    "dont know",
    "i do not know",
    "i don't want to answer",
    "i do not want to answer",
    "skip",
    "no idea",
    "can't answer",
    "cannot answer"
  ];
  return patterns.some((item) => value.includes(item));
}

function roleSpecificQuestion(role) {
  const value = role.toLowerCase();
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

function nextFromList(state, list, key) {
  const indexKey = `${key}Index`;
  const index = state[indexKey] % list.length;
  state[indexKey] += 1;
  return list[index];
}

function roleBasedPrompt(state) {
  const cleanRole = state.role || "this role";
  const cleanCompany = state.company || "our company";
  const firstQuestion = interviewQuestionBank[0];
  const special = roleSpecificQuestion(cleanRole);
  return `Mock interview set for ${cleanRole} at ${cleanCompany}. First question: ${firstQuestion} Bonus question later: ${special}`;
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

export function createModeState() {
  return {
    interview: {
      role: "",
      company: "",
      setupDone: false,
      questionIndex: 0,
      coachingIndex: 0
    },
    casual: {
      promptIndex: 0
    }
  };
}

export function updateInterviewContext(state, role, company) {
  state.interview.role = role.trim();
  state.interview.company = company.trim();
  state.interview.setupDone = Boolean(state.interview.role || state.interview.company);
  state.interview.questionIndex = 0;
  state.interview.coachingIndex = 0;
  return roleBasedPrompt(state.interview);
}

export function getModeOpening(mode, state) {
  if (mode === "Interview") {
    if (!state.interview.setupDone) {
      return "Before we start, set role and company in Interview Setup, then click Set Interview Context.";
    }
    state.interview.questionIndex = 1;
    return roleBasedPrompt(state.interview);
  }

  if (mode === "Casual") {
    return "Hey, great to chat with you. How has your day been so far?";
  }

  if (mode === "Professional") {
    return "Hello. Please introduce yourself briefly and mention your current focus area.";
  }

  return "Hi. Share a light introduction in a friendly and respectful tone.";
}

export function buildModeReply(mode, improvedUserText, state) {
  if (mode === "Interview") {
    const coach = buildInterviewCoaching(improvedUserText) || nextFromList(state.interview, coachingLines, "coaching");
    const nextQuestion = nextFromList(state.interview, interviewQuestionBank, "question");
    return `${coach} Next question: ${nextQuestion}`;
  }

  if (mode === "Casual") {
    if (isNonAnswer(improvedUserText)) {
      const nextPrompt = nextFromList(state.casual, casualPrompts, "prompt");
      return `Your answer did not address the question. Please respond to the question in one clear sentence. ${nextPrompt}`;
    }
    const nextPrompt = nextFromList(state.casual, casualPrompts, "prompt");
    return `Thanks for sharing that. ${nextPrompt} Add one specific personal example in your next response.`;
  }

  if (mode === "Professional") {
    if (isNonAnswer(improvedUserText)) {
      return "Your answer did not address the question. Please provide a direct and professional response in 2-3 lines.";
    }
    return "Good direction. In professional settings, lead with context, then your action, then the outcome. Can you share one real workplace-style example?";
  }

  if (isNonAnswer(improvedUserText)) {
    return "Your answer did not address the question. Please respond directly and keep your tone clear and respectful.";
  }
  return "Nice energy. Keep it playful but respectful, and ask one open-ended question to keep the flow going. What would you say next?";
}
