const AUTH_TOKEN_KEY = "ai_comm_auth_token";
const USER_KEY = "ai_comm_coach_user";

function authBase() {
  return window.location.port === "3000" ? "" : "http://localhost:3000";
}

async function api(path, options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || "";
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${authBase()}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_err) {
    data = { error: text || "Invalid server response" };
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function saveAuth(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch (_err) {
    return null;
  }
}

export async function sendOtp(mobile) {
  return api("/api/auth/send-otp", {
    method: "POST",
    body: { mobile }
  });
}

export async function registerWithOtp(payload) {
  const data = await api("/api/auth/register", {
    method: "POST",
    body: payload
  });
  saveAuth(data.token, data.user);
  return data;
}

export async function loginWithOtp(payload) {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: payload
  });
  saveAuth(data.token, data.user);
  return data;
}

export async function fetchCurrentUser() {
  const data = await api("/api/auth/me", { method: "GET" });
  if (data?.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  return data?.user || null;
}

export async function logoutUser() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    clearAuth();
  }
}

export async function saveSessionReport(report) {
  return api("/api/reports/save", {
    method: "POST",
    body: { report }
  });
}

export async function listSessionReports() {
  const data = await api("/api/reports/list", { method: "GET" });
  return Array.isArray(data?.reports) ? data.reports : [];
}

export async function clearSessionReports() {
  return api("/api/reports/clear", { method: "POST" });
}
