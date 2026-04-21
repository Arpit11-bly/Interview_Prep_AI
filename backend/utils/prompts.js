const questionAnswerPrompt = (role, experience, topicsToFocus, numberOfQuestions) => `
You are an AI trained to generate technical interview questions and answers.

Task:
- Role: ${role}
- Candidate Experience Bracket: ${experience}
- Focus Topics: ${topicsToFocus}
- Write ${numberOfQuestions} interview questions.
- Questions must feel tailored to the role, the candidate's experience bracket, and the listed focus topics.
- Vary the difficulty naturally across the set, but keep it appropriate for the experience bracket.
- Prefer practical, scenario-based, architecture, debugging, tradeoff, and project questions over generic textbook questions.
- For each question, generate a detailed but clear answer that matches the difficulty of the question.
- If the answer needs a code example, add a small code block inside.
- Keep formatting very clean.
- Return a pure JSON array like:
[
  {
    "question": "Question here?",
    "answer": "Answer here."
  },
  ...
]
Important: Do NOT add any extra text. Only return valid JSON.
`;

const conceptExplainPrompt = (question) => `
You are an AI trained to generate explanations for a given interview question.

Task:

- Explain the following interview question and its concept in depth as if you're teaching a beginner developer.
- Question: "${question}"
- After the explanation, provide a short and clear title that summarizes the concept for the article or page header.
- If the explanation includes a code example, provide a small code block.
- Keep the formatting very clean and clear.
- Return the result as a valid JSON object in the following format:

{
  "title": "Short title here?",
  "explanation": "Explanation here."
}

Important: Do NOT add any extra text outside the JSON format. Only return valid JSON.
`; 

module.exports = { questionAnswerPrompt, conceptExplainPrompt };
