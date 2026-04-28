const express = require("express");
const { requireAdmin } = require("../middlewares/authmiddleware");
const {
  getAdminOverview,
  getAllUsersForAdmin,
  getAdminUserDetail,
  updateAdminUser,
} = require("../controllers/adminController");

const router = express.Router();

router.get("/overview", requireAdmin, getAdminOverview);
router.get("/users", requireAdmin, getAllUsersForAdmin);
router.get("/users/:id", requireAdmin, getAdminUserDetail);
router.patch("/users/:id", requireAdmin, updateAdminUser);

module.exports = router;
