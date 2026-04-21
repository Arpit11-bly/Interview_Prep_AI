const { GoogleGenAI } = require("@google/genai");

const {
  conceptExplainPrompt,
  questionAnswerPrompt,
} = require("../utils/prompts");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// 🔧 Utility: Extract text safely from Gemini response
const extractTextFromResponse = (response) => {
  try {
    if (!response) return "";

    // New SDK structure
    const text =
      response?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") || "";

    return text.trim();
  } catch (err) {
    console.error("Text extraction error:", err);
    return "";
  }
};

// 🔧 Utility: Clean markdown
const cleanText = (text) => {
  if (!text) return "";

  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
};

const extractJsonPayload = (text) => {
  const cleanedText = cleanText(text);

  const firstObject = cleanedText.indexOf("{");
  const lastObject = cleanedText.lastIndexOf("}");
  const firstArray = cleanedText.indexOf("[");
  const lastArray = cleanedText.lastIndexOf("]");

  if (
    firstArray !== -1 &&
    lastArray !== -1 &&
    (firstObject === -1 || firstArray < firstObject)
  ) {
    return cleanedText.slice(firstArray, lastArray + 1);
  }

  if (firstObject !== -1 && lastObject !== -1) {
    return cleanedText.slice(firstObject, lastObject + 1);
  }

  return cleanedText;
};

// 🔧 Utility: Safe JSON parse with fallback
const safeJsonParse = (text) => {
  try {
    return { success: true, data: JSON.parse(text) };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 🔧 Utility: Validate AI JSON structure
const validateQuestionsFormat = (data) => {
  if (!Array.isArray(data)) return false;

  return data.every(
    (item) =>
      typeof item === "object" &&
      item.question &&
      item.answer
  );
};

// @desc Generate interview questions and answers
const generateInterviewQuestions = async (req, res) => {
  try {
    const { role, experience, topicsToFocus, numberOfQuestions } = req.body;

    // ✅ Strong input validation
    if (
      !role ||
      !experience ||
      !topicsToFocus ||
      !numberOfQuestions
    ) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    if (typeof numberOfQuestions !== "number" || numberOfQuestions <= 0) {
      return res.status(400).json({
        message: "numberOfQuestions must be a positive number",
      });
    }

    if (numberOfQuestions > 50) {
      return res.status(400).json({
        message: "Too many questions requested (max 50)",
      });
    }

    const prompt = questionAnswerPrompt(
      String(role).trim(),
      String(experience).trim(),
      String(topicsToFocus).trim(),
      numberOfQuestions
    );

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    // ✅ Extract text safely
    const rawText = extractTextFromResponse(response);

    if (!rawText) {
      return res.status(500).json({
        message: "Empty response from AI",
      });
    }

    // ✅ Debug log (optional)
    //console.log("RAW AI:", rawText);

    const jsonPayload = extractJsonPayload(rawText);

    // ✅ Parse JSON safely
    const parsed = safeJsonParse(jsonPayload);

    if (!parsed.success) {
      return res.status(500).json({
        message: "Invalid JSON from AI",
        error: parsed.error,
        raw: rawText,
      });
    }

    // ✅ Validate structure
    if (!validateQuestionsFormat(parsed.data)) {
      return res.status(500).json({
        message: "AI returned unexpected format",
        raw: parsed.data,
      });
    }

    res.status(200).json(parsed.data);
  } catch (error) {
    console.error("AI Error:", error);

    res.status(500).json({
      message: "Failed to generate questions",
      error: error.message,
    });
  }
};

// @desc Generate explanation
const generateConceptExplanation = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        message: "Valid question is required",
      });
    }

    const prompt = conceptExplainPrompt(question);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const rawText = extractTextFromResponse(response);

    if (!rawText) {
      return res.status(500).json({
        message: "Empty response from AI",
      });
    }

    console.log("RAW AI:", rawText);

    const jsonPayload = extractJsonPayload(rawText);

   const parsed = safeJsonParse(jsonPayload);

    if (!parsed.success) {
      return res.status(500).json({
        message: "Invalid JSON from AI",
        error: parsed.error,
        raw: rawText,
      });
    }

    res.status(200).json(parsed.data);
  } catch (error) {
    console.error("AI Error:", error);

    res.status(500).json({
      message: "Failed to generate explanation",
      error: error.message,
    });
  }
};

module.exports = {
  generateInterviewQuestions,
  generateConceptExplanation,
};
