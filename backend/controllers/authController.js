const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const AuthOtp = require("../models/AuthOtp");
const {
  normalizeEmail,
  isValidEmailFormat,
  hasMailExchange,
  sendOtpEmail,
} = require("../utils/emailService");

const OTP_EXPIRY_MINUTES = 10;

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  profileImageUrl: user.profileImageUrl,
});

const isInvalidRecipientError = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("recipient") ||
    message.includes("mailbox") ||
    message.includes("user unknown") ||
    message.includes("invalid address") ||
    message.includes("no such user")
  );
};

const validatePassword = (password) => {
  if (!password) return "Password is required.";
  if (String(password).length < 8) return "Password must be at least 8 characters.";
  return "";
};

const validateName = (name) => {
  if (!String(name || "").trim()) return "Full name is required.";
  return "";
};

const validateEmailForAuth = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmailFormat(normalizedEmail)) {
    return { valid: false, message: "Invalid email id." };
  }

  const hasMx = await hasMailExchange(normalizedEmail);
  if (!hasMx) {
    return { valid: false, message: "Invalid email id." };
  }

  return { valid: true, email: normalizedEmail };
};

const upsertOtp = async ({ email, purpose, otp, payload = {} }) => {
  await AuthOtp.findOneAndUpdate(
    { email, purpose },
    {
      email,
      purpose,
      otpHash: hashValue(otp),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      attempts: 0,
      payload,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
};

const verifyStoredOtp = async ({ email, purpose, otp }) => {
  const otpDoc = await AuthOtp.findOne({ email, purpose });

  if (!otpDoc || otpDoc.expiresAt.getTime() < Date.now()) {
    if (otpDoc) {
      await AuthOtp.deleteOne({ _id: otpDoc._id });
    }
    return { ok: false, message: "OTP is invalid or expired." };
  }

  const nextAttempts = Number(otpDoc.attempts || 0) + 1;
  otpDoc.attempts = nextAttempts;
  await otpDoc.save();

  if (nextAttempts > 5) {
    await AuthOtp.deleteOne({ _id: otpDoc._id });
    return { ok: false, message: "Too many invalid OTP attempts. Please request a new OTP." };
  }

  if (otpDoc.otpHash !== hashValue(otp)) {
    return { ok: false, message: "OTP is invalid or expired." };
  }

  return { ok: true, otpDoc };
};

const checkEmailAvailability = async (req, res) => {
  try {
    const result = await validateEmailForAuth(req.query.email);

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    const user = await User.findOne({ email: result.email });

    return res.status(200).json({
      available: !user,
      exists: Boolean(user),
      message: user ? "Email id already exists." : "Email id looks valid.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const sendRegisterOtp = async (req, res) => {
  try {
    const { name, email, password, profileImageUrl } = req.body;

    const nameError = validateName(name);
    if (nameError) {
      return res.status(400).json({ message: nameError });
    }

    const emailValidation = await validateEmailForAuth(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ message: emailValidation.message });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const existingUser = await User.findOne({ email: emailValidation.email });
    if (existingUser) {
      return res.status(409).json({ message: "Email id already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(password), salt);
    const otp = generateOtp();

    await upsertOtp({
      email: emailValidation.email,
      purpose: "register",
      otp,
      payload: {
        name: String(name).trim(),
        password: hashedPassword,
        profileImageUrl: profileImageUrl || "",
      },
    });

    try {
      await sendOtpEmail({
        email: emailValidation.email,
        name: String(name).trim(),
        otp,
        purpose: "register",
      });
    } catch (error) {
      await AuthOtp.deleteOne({ email: emailValidation.email, purpose: "register" });

      if (isInvalidRecipientError(error)) {
        return res.status(400).json({ message: "Invalid email id." });
      }

      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json({
      message: "OTP sent to your email successfully.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const verifyRegisterOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await AuthOtp.deleteOne({ email, purpose: "register" });
      return res.status(409).json({ message: "Email id already exists." });
    }

    const verified = await verifyStoredOtp({
      email,
      purpose: "register",
      otp,
    });

    if (!verified.ok) {
      return res.status(400).json({ message: verified.message });
    }

    const { name, password, profileImageUrl } = verified.otpDoc.payload || {};

    const user = await User.create({
      name,
      email,
      password,
      profileImageUrl: profileImageUrl || "",
    });

    await AuthOtp.deleteOne({ _id: verified.otpDoc._id });

    return res.status(201).json({
      ...sanitizeUser(user),
      token: generateToken(user._id),
      message: "Signup completed successfully.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!isValidEmailFormat(email)) {
      return res.status(400).json({ message: "Invalid email id." });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    return res.status(200).json({
      ...sanitizeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const sendForgotPasswordOtp = async (req, res) => {
  try {
    const emailValidation = await validateEmailForAuth(req.body.email);
    if (!emailValidation.valid) {
      return res.status(400).json({ message: emailValidation.message });
    }

    const user = await User.findOne({ email: emailValidation.email });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email id." });
    }

    const otp = generateOtp();

    await upsertOtp({
      email: emailValidation.email,
      purpose: "reset-password",
      otp,
      payload: { userId: String(user._id) },
    });

    try {
      await sendOtpEmail({
        email: emailValidation.email,
        name: user.name,
        otp,
        purpose: "reset-password",
      });
    } catch (error) {
      await AuthOtp.deleteOne({ email: emailValidation.email, purpose: "reset-password" });

      if (isInvalidRecipientError(error)) {
        return res.status(400).json({ message: "Invalid email id." });
      }

      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json({
      message: "Password reset OTP sent to your registered email.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required." });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const verified = await verifyStoredOtp({
      email,
      purpose: "reset-password",
      otp,
    });

    if (!verified.ok) {
      return res.status(400).json({ message: verified.message });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await AuthOtp.deleteOne({ _id: verified.otpDoc._id });
      return res.status(404).json({ message: "No account found with this email id." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await AuthOtp.deleteOne({ _id: verified.otpDoc._id });

    return res.status(200).json({
      message: "Password changed successfully. Please login with your new password.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  checkEmailAvailability,
  sendRegisterOtp,
  verifyRegisterOtp,
  loginUser,
  sendForgotPasswordOtp,
  resetPasswordWithOtp,
  getUserProfile,
};
