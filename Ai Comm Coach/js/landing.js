import {
  sendOtp,
  registerWithOtp,
  loginWithOtp,
  getSavedUser
} from "./auth-client.js";

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");
const registerMsg = document.getElementById("registerMsg");
const landingStatus = document.getElementById("landingStatus");
const existingUserBtn = document.getElementById("existingUserBtn");
const authTabs = document.getElementById("authTabs");

function normalizeMobile(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function setAuthTab(tabName) {
  document.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".auth-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });

  registerMsg.textContent = "";
}

const existing = getSavedUser();
if (existing?.name) {
  landingStatus.textContent = `Logged in as ${existing.name}. Continue to dashboard.`;
  existingUserBtn.textContent = "Continue To Coach";
}

authTabs?.addEventListener("click", (event) => {
  const btn = event.target.closest(".auth-tab");
  if (!btn) return;
  setAuthTab(btn.dataset.tab);
});

const sendRegOtpBtn = document.getElementById("sendRegOtpBtn");
sendRegOtpBtn?.addEventListener("click", async () => {
  const mobile = normalizeMobile(document.getElementById("regMobile").value);
  if (mobile.length !== 10) {
    registerMsg.textContent = "Enter valid 10-digit mobile number first.";
    return;
  }

  try {
    const res = await sendOtp(mobile);
    registerMsg.textContent = res.demoOtp
      ? `OTP sent (demo): ${res.demoOtp}`
      : "OTP sent to your mobile.";
  } catch (err) {
    registerMsg.textContent = err.message;
  }
});

const sendLoginOtpBtn = document.getElementById("sendLoginOtpBtn");
sendLoginOtpBtn?.addEventListener("click", async () => {
  const mobile = normalizeMobile(document.getElementById("loginMobile").value);
  if (mobile.length !== 10) {
    registerMsg.textContent = "Enter valid 10-digit mobile number first.";
    return;
  }

  try {
    const res = await sendOtp(mobile);
    registerMsg.textContent = res.demoOtp
      ? `OTP sent (demo): ${res.demoOtp}`
      : "OTP sent to your mobile.";
  } catch (err) {
    registerMsg.textContent = err.message;
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("regName").value.trim(),
    email: document.getElementById("regEmail").value.trim(),
    mobile: normalizeMobile(document.getElementById("regMobile").value),
    otp: document.getElementById("regOtp").value.trim()
  };

  if (!payload.name || !payload.email || payload.mobile.length !== 10 || !payload.otp) {
    registerMsg.textContent = "Fill all register fields correctly.";
    return;
  }

  try {
    await registerWithOtp(payload);
    registerMsg.textContent = "Registration successful. Redirecting...";
    setTimeout(() => {
      window.location.href = "./coach.html";
    }, 500);
  } catch (err) {
    registerMsg.textContent = err.message;
  }
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    mobile: normalizeMobile(document.getElementById("loginMobile").value),
    otp: document.getElementById("loginOtp").value.trim()
  };

  if (payload.mobile.length !== 10 || !payload.otp) {
    registerMsg.textContent = "Enter valid mobile and OTP.";
    return;
  }

  try {
    await loginWithOtp(payload);
    registerMsg.textContent = "Login successful. Redirecting...";
    setTimeout(() => {
      window.location.href = "./coach.html";
    }, 500);
  } catch (err) {
    registerMsg.textContent = err.message;
  }
});

setAuthTab("register");
