const express = require("express");
const {
  checkEmailAvailability,
  sendRegisterOtp,
  verifyRegisterOtp,
  loginUser,
  loginAdmin,
  sendForgotPasswordOtp,
  resetPasswordWithOtp,
  getUserProfile,
} = require("../controllers/authController");
const{ protect }= require("../middlewares/authmiddleware");
const upload = require("../middlewares/uploadmiddleware");

const router = express.Router();

//Auth Routes

router.get("/check-email", checkEmailAvailability);
router.post("/register/send-otp", sendRegisterOtp);
router.post("/register/verify-otp", verifyRegisterOtp);
router.post("/login" , loginUser);  //LoginUSer
router.post("/admin/login", loginAdmin);
router.post("/forgot-password/send-otp", sendForgotPasswordOtp);
router.post("/forgot-password/reset", resetPasswordWithOtp);
router.get("/profile", protect, getUserProfile); //get user profile

router.post("/upload-image", upload.single("image"), (req, res) => {
    if(!req.file){
        return res.status(400).json({message:"No file uploaded"});
        
    }
    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
        req.file.filename
    }`;
    res.status(200).json({imageUrl});

});

module.exports = router;
