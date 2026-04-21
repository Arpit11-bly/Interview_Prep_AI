export const BASE_URL = "http://localhost:8000";

export const API_PATHS = {
  AUTH: {
    CHECK_EMAIL: "/api/auth/check-email",
    REGISTER_SEND_OTP: "/api/auth/register/send-otp",
    REGISTER_VERIFY_OTP: "/api/auth/register/verify-otp",
    LOGIN: "/api/auth/login", // Authenticate user & return JWT token
    FORGOT_PASSWORD_SEND_OTP: "/api/auth/forgot-password/send-otp",
    FORGOT_PASSWORD_RESET: "/api/auth/forgot-password/reset",
    GET_PROFILE: "/api/auth/profile", // Get logged-in user details
  },

  IMAGE: {
    UPLOAD_IMAGE: "/api/auth/upload-image", // Upload profile picture
  },

  AI: {
    GENERATE_QUESTIONS: "/api/ai/generate-questions", // Generate interview questions and answers using Gemini
    GENERATE_EXPLANATION: "/api/ai/generate-explanation", // Generate concept explanation using Gemini
  },

  SESSION: {
    CREATE: "/api/sessions/create", // Create a new interview session with questions
    GET_ALL: "/api/sessions/my-sessions", // Get all user sessions
    GET_ONE: (id) => `/api/sessions/${id}`, // Get session details with questions
    DELETE: (id) => `/api/sessions/${id}`, // Delete a session
  },

  QUESTION: {
    ADD_TO_SESSION: "/api/questions/add", // Add more questions to a session
    PIN: (id) => `/api/questions/${id}/pin`, // Pin or Unpin a question
    UPDATE_NOTE: (id) => `/api/questions/${id}/note`, // Update/Add a note to a question
  },

  COACH: {
    OPENING: "/api/coach/opening",
    TURN: "/api/coach/turn",
    ANSWER_TIPS: "/api/coach/answer-tips",
    REPORT: "/api/coach/report",
    REPORTS: "/api/coach/reports",
  },
};
