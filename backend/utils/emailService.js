const { promises: dns } = require("node:dns");

let nodemailer = null;

try {
  nodemailer = require("nodemailer");
} catch (_error) {
  nodemailer = null;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isValidEmailFormat = (email) => emailRegex.test(normalizeEmail(email));

const hasMailExchange = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const domain = normalizedEmail.split("@")[1];

  if (!domain) return false;

  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (_error) {
    return false;
  }
};

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!nodemailer) {
    throw new Error("Email service dependency missing. Install nodemailer in backend.");
  }

  if (!host || !port || !user || !pass) {
    throw new Error("Email service is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465 || process.env.SMTP_SECURE === "true",
    auth: {
      user,
      pass,
    },
  });
};

const sendOtpEmail = async ({ email, name, otp, purpose }) => {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const intro =
    purpose === "register"
      ? "Use this OTP to complete your Interview Prep AI signup."
      : "Use this OTP to reset your Interview Prep AI password.";

  const subject =
    purpose === "register"
      ? "Your Interview Prep AI signup OTP"
      : "Your Interview Prep AI password reset OTP";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">Interview Prep AI</h2>
      <p style="margin-bottom: 16px;">Hi ${name || "there"},</p>
      <p style="margin-bottom: 16px;">${intro}</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; padding: 14px 18px; background: #fff7ed; border: 1px solid #fdba74; border-radius: 12px; display: inline-block;">
        ${otp}
      </div>
      <p style="margin-top: 16px;">This OTP expires in 10 minutes.</p>
      <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return transporter.sendMail({
    from,
    to: normalizeEmail(email),
    subject,
    text: `${intro} Your OTP is ${otp}. It expires in 10 minutes.`,
    html,
  });
};

module.exports = {
  normalizeEmail,
  isValidEmailFormat,
  hasMailExchange,
  sendOtpEmail,
};
