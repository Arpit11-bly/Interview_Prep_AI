const mongoose = require("mongoose");

const coachReportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mode: { type: String, required: true },
    customConversationType: { type: String, default: "" },
    isAdminAssigned: { type: Boolean, default: false },
    assignedPreparationRole: { type: String, default: "" },
    interviewContext: {
      role: { type: String, default: "" },
      company: { type: String, default: "" },
      jd: { type: String, default: "" },
    },
    summary: { type: String, default: "" },
    tips: { type: String, default: "" },
    adminFeedback: { type: String, default: "" },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
    scores: {
      grammar: { type: Number, default: 0 },
      fluency: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      technicalKnowledge: { type: Number, default: 0 },
    },
    performance: {
      relevance: { type: Number, default: 0 },
      structure: { type: Number, default: 0 },
      vocabulary: { type: Number, default: 0 },
      consistency: { type: Number, default: 0 },
    },
    conversation: [
      {
        aiQuestion: { type: String, default: "" },
        user: { type: String, default: "" },
        betterAnswer: { type: String, default: "" },
        aiReply: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoachReport", coachReportSchema);
