const fillerWords = ["um", "uh", "like", "you know", "actually", "basically", "literally"];

function countMatches(text, pattern) {
  const found = text.match(pattern);
  return found ? found.length : 0;
}

function uniqueByLower(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = item.toLowerCase();
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return [...map.values()];
}

export function scoreSession(entries) {
  if (!entries.length) {
    return {
      grammar: 0,
      fluency: 0,
      confidence: 0,
      tips: "Start a conversation first to generate feedback.",
      report: null
    };
  }

  const originalText = entries.map((entry) => entry.original).join(" ");
  const improvedText = entries.map((entry) => entry.improved).join(" ");

  const totalWords = countMatches(originalText, /\b[\w']+\b/g);
  const totalSentences = Math.max(1, countMatches(originalText, /[.!?]/g));
  const avgWordsPerSentence = Math.max(1, Math.round((totalWords / totalSentences) * 10) / 10);

  const fillerCount = fillerWords
    .map((word) => countMatches(originalText, new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")))
    .reduce((sum, count) => sum + count, 0);

  const weakGrammarSignals = countMatches(originalText, /\bi\b/g) + countMatches(originalText, /\bu\b/gi);
  const repeatPenalty = Math.max(0, entries.length - uniqueByLower(entries.map((entry) => entry.original)).length);

  const grammar = Math.max(52, Math.min(97, Math.round(86 - weakGrammarSignals * 4 - repeatPenalty * 3 + entries.length * 1.5)));
  const fluency = Math.max(50, Math.min(96, Math.round(84 - fillerCount * 2 + Math.min(8, avgWordsPerSentence))));
  const confidence = Math.max(48, Math.min(97, Math.round(82 - fillerCount + entries.length * 1.2)));

  const strengths = [];
  const improvements = [];

  if (grammar >= 78) strengths.push("Sentence structure is mostly clear and understandable.");
  else improvements.push("Use full sentences with a clear subject and verb.");

  if (fluency >= 78) strengths.push("Flow is stable with decent sentence length.");
  else improvements.push("Reduce filler words and pause between ideas, not inside phrases.");

  if (confidence >= 78) strengths.push("Tone sounds assertive and purposeful.");
  else improvements.push("Start key points with confident openers like 'I can', 'I have', 'I will'.");

  if (!strengths.length) strengths.push("You stayed engaged throughout the conversation.");
  if (!improvements.length) improvements.push("Push for richer vocabulary and specific examples for stronger impact.");

  const examples = entries
    .filter((entry) => entry.original.trim().toLowerCase() !== entry.improved.trim().toLowerCase())
    .slice(0, 5)
    .map((entry) => ({
      from: entry.original,
      to: entry.improved
    }));

  const tips = `${improvements[0]} ${improvements[1] || ""}`.trim();

  return {
    grammar,
    fluency,
    confidence,
    tips,
    report: {
      totals: {
        responses: entries.length,
        words: totalWords,
        averageWordsPerSentence: avgWordsPerSentence,
        fillerWords: fillerCount
      },
      strengths,
      improvements,
      examples,
      summary: `You completed ${entries.length} responses. Focus on precision and confident delivery to move to the next level.`
    }
  };
}
