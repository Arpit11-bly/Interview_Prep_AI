const express = require("express");
const { requireAdmin } = require("../middlewares/authmiddleware");
const {
  getAdminOverview,
  getAllUsersForAdmin,
  getAdminUserDetail,
  updateAdminUser,
  updateReportFeedback,
  deleteAdminSession,
  deleteAdminUser,
} = require("../controllers/adminController");

const router = express.Router();

router.get("/overview", requireAdmin, getAdminOverview);
router.get("/users", requireAdmin, getAllUsersForAdmin);
router.get("/users/:id", requireAdmin, getAdminUserDetail);
router.patch("/users/:id", requireAdmin, updateAdminUser);
router.delete("/users/:id", requireAdmin, deleteAdminUser);
router.delete("/sessions/:sessionId", requireAdmin, deleteAdminSession);
router.patch("/reports/:reportId/feedback", requireAdmin, updateReportFeedback);

module.exports = router;
