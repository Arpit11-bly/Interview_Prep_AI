const CoachReport = require("../models/CoachReport");
const User = require("../models/User");
const {
  generateOpening,
  generateTurn,
  generateAnswerTips,
  generateReport,
} = require("../utils/coachEngine");

exports.getCoachOpening = async (req, res) => {
  try {
    const data = await generateOpening(req.body || {});
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate opening", error: error.message });
  }
};

exports.getCoachTurn = async (req, res) => {
  try {
    const data = await generateTurn(req.body || {});
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate coach turn", error: error.message });
  }
};

exports.getAnswerTips = async (req, res) => {
  try {
    const data = await generateAnswerTips(req.body || {});
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate answer tips", error: error.message });
  }
};

exports.generateAndSaveReport = async (req, res) => {
  try {
    const activeUser = await User.findById(req.user._id).select("assignedPreparationRole adminNotes assignedByAdminAt");
    const assignedRole = String(activeUser?.assignedPreparationRole || "").trim();
    const reportRole = String(req.body.interviewContext?.role || "").trim();
    const isAssignedRoleMatch = Boolean(
      assignedRole && reportRole && assignedRole.toLowerCase() === reportRole.toLowerCase()
    );
    const isAdminAssignedAttempt = Boolean(req.body.isAdminAssigned) || isAssignedRoleMatch;

    const reportData = await generateReport(req.body || {});

    const savedReport = await CoachReport.create({
      user: req.user._id,
      mode: req.body.mode || "Interview",
      customConversationType: req.body.customConversationType || "",
      isAdminAssigned: isAdminAssignedAttempt,
      assignedPreparationRole: String(req.body.assignedPreparationRole || assignedRole || "").trim(),
      interviewContext: req.body.interviewContext || {},
      summary: reportData.report?.summary || "",
      tips: reportData.tips || "",
      strengths: reportData.report?.strengths || [],
      improvements: reportData.report?.improvements || [],
      scores: {
        grammar: reportData.grammar || 0,
        fluency: reportData.fluency || 0,
        confidence: reportData.confidence || 0,
        technicalKnowledge: reportData.technicalKnowledge || 0,
      },
      performance: reportData.performance || {},
      conversation: reportData.conversation || [],
    });

    const updatedUser = isAdminAssignedAttempt
      ? await User.findByIdAndUpdate(
          req.user._id,
          {
            assignedPreparationRole: "",
            adminNotes: "",
            assignedByAdminAt: null,
          },
          { new: true }
        ).select("-password")
      : null;

    res.status(200).json({
      ...reportData,
      reportId: savedReport._id,
      assignmentCompleted: isAdminAssignedAttempt,
      user: updatedUser
        ? {
            ...updatedUser.toObject(),
            role: "user",
            assignedPreparationRole: "",
            adminNotes: "",
            assignedByAdminAt: null,
            isActive: updatedUser.isActive !== false,
          }
        : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate coach report", error: error.message });
  }
};

exports.getCoachReports = async (req, res) => {
  try {
    const reports = await CoachReport.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch coach reports", error: error.message });
  }
};

exports.clearCoachReports = async (req, res) => {
  try {
    await CoachReport.deleteMany({ user: req.user._id });
    res.status(200).json({ message: "Coach reports cleared successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear coach reports", error: error.message });
  }
};
