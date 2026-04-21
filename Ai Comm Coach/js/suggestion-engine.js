const fillers = ["um", "uh", "like", "you know", "actually", "basically", "literally"];

function normalizeSpacing(text) {
  return text.replace(/\s+/g, " ").trim();
}

function sentenceCase(text) {
  const clean = normalizeSpacing(text);
  if (!clean) {
    return "";
  }
  const withCapital = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(withCapital) ? withCapital : `${withCapital}.`;
}

function softGrammarFix(text) {
  return normalizeSpacing(
    text
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

function removeFillers(text) {
  let out = text;
  fillers.forEach((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
  });
  return normalizeSpacing(out);
}

function modeSpecificRewrite(text, mode) {
  if (mode === "Interview") {
    return text
      .replace(/^I want/gi, "I am interested")
      .replace(/\bI did\b/gi, "I delivered")
      .replace(/\bgood at\b/gi, "strong in");
  }

  if (mode === "Casual") {
    return text
      .replace(/\bI am\b/gi, "I'm")
      .replace(/\bdo not\b/gi, "don't");
  }

  if (mode === "Professional") {
    return text
      .replace(/^Can you/gi, "Could you")
      .replace(/\bhelp me\b/gi, "assist me")
      .replace(/\bASAP\b/g, "as soon as possible");
  }

  return text;
}

export function improveSentence(input, options = {}) {
  const cleaned = normalizeSpacing(input);
  if (!cleaned) {
    return [];
  }

  const mode = options.mode || "Interview";
  const recent = Array.isArray(options.recentSuggestions) ? options.recentSuggestions : [];

  const grammar = sentenceCase(softGrammarFix(cleaned));
  const concise = sentenceCase(removeFillers(softGrammarFix(cleaned)));
  const modeRewrite = sentenceCase(modeSpecificRewrite(softGrammarFix(cleaned), mode));

  const confidenceOpeners = [
    "I can contribute by",
    "My key strength is",
    "I am confident in"
  ];
  const opener = confidenceOpeners[cleaned.length % confidenceOpeners.length];
  const compact = removeFillers(softGrammarFix(cleaned)).replace(/^[A-Z][^.?!]*$/i, (v) => v.toLowerCase());
  const confident = sentenceCase(`${opener} ${compact}`);

  const candidates = [grammar, modeRewrite, concise, confident]
    .map((item) => normalizeSpacing(item))
    .filter(Boolean);

  const unique = [];
  candidates.forEach((item) => {
    const key = item.toLowerCase();
    const repeated = recent.some((r) => r.toLowerCase() === key);
    const exists = unique.some((u) => u.toLowerCase() === key);
    if (!repeated && !exists) {
      unique.push(item);
    }
  });

  return unique.slice(0, 3);
}

export function renderSuggestions(container, items, onPick) {
  container.innerHTML = "";

  if (!items.length) {
    const chip = document.createElement("button");
    chip.className = "suggestion-chip";
    chip.disabled = true;
    chip.textContent = "Answer tips will appear for the current AI question.";
    container.appendChild(chip);
    return;
  }

  items.forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "suggestion-chip";
    chip.textContent = text;
    chip.addEventListener("click", () => onPick(text));
    container.appendChild(chip);
  });
}
