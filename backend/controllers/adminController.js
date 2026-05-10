const User = require("../models/User");
const Session = require("../models/Session");
const Question = require("../models/Question");
const CoachReport = require("../models/CoachReport");

const average = (values) => {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return 0;
  const total = numeric.reduce((sum, value) => sum + value, 0);
  return Math.round((total / numeric.length) * 10) / 10;
};

const getReportOverallScore = (report) => {
  const scores = [
    Number(report?.scores?.grammar || 0),
    Number(report?.scores?.fluency || 0),
    Number(report?.scores?.confidence || 0),
    Number(report?.scores?.technicalKnowledge || 0),
  ];
  return average(scores);
};

const summarizeImprovements = (reports) => {
  const counts = new Map();

  reports.forEach((report) => {
    (report.improvements || []).forEach((item) => {
      const key = String(item || "").trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
};

const summarizeUser = ({ user, sessions, reports }) => {
  const latestSession = [...sessions].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  const latestReport = [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const lastActivityAt = latestReport?.createdAt || latestSession?.updatedAt || user.updatedAt || user.createdAt;

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    profileImageUrl: user.profileImageUrl,
    assignedPreparationRole: user.assignedPreparationRole || "",
    adminNotes: user.adminNotes || "",
    assignedByAdminAt: user.assignedByAdminAt,
    isActive: user.isActive !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    totalPrepSessions: sessions.length,
    totalMockInterviews: reports.length,
    latestPrepRole: latestSession?.role || latestReport?.interviewContext?.role || "",
    latestSessionAt: latestSession?.updatedAt || null,
    latestMockInterviewAt: latestReport?.createdAt || null,
    latestReportSummary: latestReport?.summary || "",
    latestImprovementAreas: latestReport?.improvements || [],
    averageMockScore: average(reports.map(getReportOverallScore)),
    lastActivityAt,
  };
};

const getAdminOverview = async (_req, res) => {
  try {
    const [users, sessions, reports] = await Promise.all([
      User.find().sort({ createdAt: -1 }),
      Session.find().sort({ createdAt: -1 }),
      CoachReport.find().sort({ createdAt: -1 }),
    ]);

    const roleCounts = new Map();
    sessions.forEach((session) => {
      const key = String(session.role || "").trim();
      if (!key) return;
      roleCounts.set(key, (roleCounts.get(key) || 0) + 1);
    });

    const topPreparationRoles = [...roleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([role, count]) => ({ role, count }));

    res.status(200).json({
      stats: {
        totalUsers: users.length,
        activeUsers: users.filter((user) => user.isActive !== false).length,
        assignedUsers: users.filter((user) => String(user.assignedPreparationRole || "").trim()).length,
        totalPrepSessions: sessions.length,
        totalMockInterviews: reports.length,
        averageMockScore: average(reports.map(getReportOverallScore)),
      },
      topPreparationRoles,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch admin overview", error: error.message });
  }
};

const getAllUsersForAdmin = async (_req, res) => {
  try {
    const [users, sessions, reports] = await Promise.all([
      User.find().sort({ createdAt: -1 }),
      Session.find().select("user role updatedAt createdAt"),
      CoachReport.find().select("user interviewContext summary improvements scores isAdminAssigned assignedPreparationRole adminFeedback createdAt"),
    ]);

    const sessionsByUser = new Map();
    sessions.forEach((session) => {
      const key = String(session.user);
      const rows = sessionsByUser.get(key) || [];
      rows.push(session);
      sessionsByUser.set(key, rows);
    });

    const reportsByUser = new Map();
    reports.forEach((report) => {
      const key = String(report.user);
      const rows = reportsByUser.get(key) || [];
      rows.push(report);
      reportsByUser.set(key, rows);
    });

    const data = users.map((user) =>
      summarizeUser({
        user,
        sessions: sessionsByUser.get(String(user._id)) || [],
        reports: reportsByUser.get(String(user._id)) || [],
      })
    );

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users for admin", error: error.message });
  }
};

const getAdminUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [sessions, reports] = await Promise.all([
      Session.find({ user: user._id }).populate("questions").sort({ updatedAt: -1 }),
      CoachReport.find({ user: user._id }).sort({ createdAt: -1 }),
    ]);

    const reportSummary = {
      averageMockScore: average(reports.map(getReportOverallScore)),
      commonImprovements: summarizeImprovements(reports),
      latestReport: reports[0] || null,
    };

    res.status(200).json({
      user: summarizeUser({ user, sessions, reports }),
      sessions,
      reports,
      reportSummary,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user detail", error: error.message });
  }
};

const updateAdminUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const assignedPreparationRole = String(req.body.assignedPreparationRole || "").trim();
    const adminNotes = String(req.body.adminNotes || "").trim();
    const hasIsActive = typeof req.body.isActive === "boolean";

    user.assignedPreparationRole = assignedPreparationRole;
    user.adminNotes = adminNotes;
    user.assignedByAdminAt = assignedPreparationRole ? new Date() : null;

    if (hasIsActive) {
      user.isActive = req.body.isActive;
    }

    await user.save();

    res.status(200).json({
      message: "User assignment updated successfully",
      user: {
        _id: user._id,
        assignedPreparationRole: user.assignedPreparationRole,
        adminNotes: user.adminNotes,
        assignedByAdminAt: user.assignedByAdminAt,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user", error: error.message });
  }
};

const updateReportFeedback = async (req, res) => {
  try {
    const report = await CoachReport.findById(req.params.reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    report.adminFeedback = String(req.body.adminFeedback || "").trim();
    await report.save();

    res.status(200).json({
      message: "Report feedback saved successfully",
      report: {
        _id: report._id,
        adminFeedback: report.adminFeedback,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to save report feedback", error: error.message });
  }
};

const deleteAdminSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    await Question.deleteMany({ session: session._id });
    await session.deleteOne();

    res.status(200).json({ message: "Session deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete session", error: error.message });
  }
};

const deleteAdminUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const sessions = await Session.find({ user: user._id }).select("_id");
    const sessionIds = sessions.map((session) => session._id);

    await Promise.all([
      Question.deleteMany({ session: { $in: sessionIds } }),
      Session.deleteMany({ user: user._id }),
      CoachReport.deleteMany({ user: user._id }),
    ]);

    await user.deleteOne();

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
};

module.exports = {
  getAdminOverview,
  getAllUsersForAdmin,
  getAdminUserDetail,
  updateAdminUser,
  updateReportFeedback,
  deleteAdminSession,
  deleteAdminUser,
};
