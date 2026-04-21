export const COACH_MODES = ["Interview", "Professional", "Casual", "Dating"];

export const LANGUAGE_OPTIONS = [
  { label: "English (India)", value: "en-IN" },
  { label: "English (US)", value: "en-US" },
  { label: "English (UK)", value: "en-GB" },
];

export function refineTranscriptText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bi\b/g, "I")
    .replace(/\bim\b/gi, "I am")
    .replace(/\bu\b/gi, "you")
    .replace(/\bgonna\b/gi, "going to")
    .replace(/\bwanna\b/gi, "want to");
}

export function chooseBestAlternative(result) {
  let best = result?.[0]?.transcript || "";
  let bestScore = Number(result?.[0]?.confidence || 0);

  for (let index = 1; index < result.length; index += 1) {
    const candidateText = result[index]?.transcript || "";
    const candidateScore = Number(result[index]?.confidence || 0);

    if (candidateText && candidateScore > bestScore) {
      best = candidateText;
      bestScore = candidateScore;
    }
  }

  return normalizeText(best);
}

export function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function appendWithoutDup(existing, chunk) {
  const base = normalizeText(existing);
  const add = normalizeText(chunk);

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

  return normalizeText(`${base} ${addWords.slice(overlap).join(" ")}`);
}

export function formatCoachDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
