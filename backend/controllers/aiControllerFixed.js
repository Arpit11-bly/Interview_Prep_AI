const { GoogleGenAI } = require("@google/genai");

const {
  conceptExplainPrompt,
  questionAnswerPrompt,
} = require("../utils/prompts");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const extractTextFromResponse = (response) => {
  try {
    if (!response) return "";

    if (typeof response.text === "string" && response.text.trim()) {
      return response.text.trim();
    }

    const text =
      response?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") || "";

    return text.trim();
  } catch (error) {
    console.error("Text extraction error:", error);
    return "";
  }
};

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

const safeJsonParse = (text) => {
  try {
    return { success: true, data: JSON.parse(text) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const validateQuestionsFormat = (data) => {
  if (!Array.isArray(data)) return false;

  return data.every(
    (item) =>
      typeof item === "object" &&
      typeof item.question === "string" &&
      typeof item.answer === "string"
  );
};

const validateExplanationFormat = (data) => {
  return (
    data &&
    typeof data === "object" &&
    typeof data.title === "string" &&
    typeof data.explanation === "string"
  );
};

const buildFallbackQuestions = (role, experience, topicsToFocus, numberOfQuestions) => {
  const safeRole = String(role || "the target role").trim();
  const safeExperience = String(experience || "0").trim();
  const topicList = String(topicsToFocus || "")
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean);

  const normalizedTopics = topicList.length
    ? topicList
    : ["core concepts", "problem solving", "project experience"];

  return Array.from({ length: numberOfQuestions }, (_, index) => {
    const topic = normalizedTopics[index % normalizedTopics.length];

    return {
      question: `How would you explain your experience with ${topic} for a ${safeRole} role?`,
      answer: `For a ${safeRole} role, answer by covering your ${safeExperience} year(s) of experience, one real example related to ${topic}, the technical decisions you made, and the result or impact you achieved.`,
    };
  });
};

const buildFallbackExplanation = (question, answer = "") => {
  const normalizedQuestion = String(question || "").trim();
  const normalizedAnswer = String(answer || "").trim();
  const title = normalizedQuestion.replace(/\?+$/, "").slice(0, 80) || "Concept Explanation";

  const explanation = normalizedAnswer
    ? `AI quota is temporarily unavailable, so this explanation is generated from the saved answer.\n\n${normalizedAnswer}`
    : "AI quota is temporarily unavailable right now. Please try again after some time.";

  return {
    title,
    explanation,
    fallback: true,
  };
};

const generateInterviewQuestions = async (req, res) => {
  try {
    const { role, experience, topicsToFocus, numberOfQuestions } = req.body;

    if (!role || !experience || !topicsToFocus || !numberOfQuestions) {
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
      role,
      experience,
      topicsToFocus,
      numberOfQuestions
    );

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const rawText = extractTextFromResponse(response);

    if (!rawText) {
      return res.status(500).json({
        message: "Empty response from AI",
      });
    }

    const parsed = safeJsonParse(extractJsonPayload(rawText));

    if (!parsed.success) {
      return res.status(500).json({
        message: "Invalid JSON from AI",
        error: parsed.error,
        raw: rawText,
      });
    }

    if (!validateQuestionsFormat(parsed.data)) {
      return res.status(500).json({
        message: "AI returned unexpected format",
        raw: parsed.data,
      });
    }

    return res.status(200).json(parsed.data);
  } catch (error) {
    console.error("AI Error:", error);

    if (error?.status === 429) {
      return res.status(200).json(
        buildFallbackQuestions(
          req.body.role,
          req.body.experience,
          req.body.topicsToFocus,
          req.body.numberOfQuestions
        )
      );
    }

    return res.status(500).json({
      message: "Failed to generate questions",
      error: error.message,
    });
  }
};

const generateConceptExplanation = async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        message: "Valid question is required",
      });
    }

    const prompt = conceptExplainPrompt(question);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const rawText = extractTextFromResponse(response);

    if (!rawText) {
      return res.status(500).json({
        message: "Empty response from AI",
      });
    }

    const parsed = safeJsonParse(extractJsonPayload(rawText));

    if (!parsed.success) {
      return res.status(500).json({
        message: "Invalid JSON from AI",
        error: parsed.error,
        raw: rawText,
      });
    }

    if (!validateExplanationFormat(parsed.data)) {
      return res.status(500).json({
        message: "AI returned unexpected explanation format",
        raw: parsed.data,
      });
    }

    return res.status(200).json(parsed.data);
  } catch (error) {
    console.error("AI Error:", error);

    if (error?.status === 429) {
      return res.status(200).json(buildFallbackExplanation(req.body.question, req.body.answer));
    }

    return res.status(500).json({
      message: "Failed to generate explanation",
      error: error.message,
    });
  }
};

module.exports = {
  generateInterviewQuestions,
  generateConceptExplanation,
};
