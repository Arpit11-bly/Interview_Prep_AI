const express = require("express");
const { protect } = require("../middlewares/authmiddleware");
const {
  getCoachOpening,
  getCoachTurn,
  getAnswerTips,
  generateAndSaveReport,
  getCoachReports,
  clearCoachReports,
} = require("../controllers/coachController");

const router = express.Router();

router.post("/opening", protect, getCoachOpening);
router.post("/turn", protect, getCoachTurn);
router.post("/answer-tips", protect, getAnswerTips);
router.post("/report", protect, generateAndSaveReport);
router.get("/reports", protect, getCoachReports);
router.delete("/reports", protect, clearCoachReports);

module.exports = router;
