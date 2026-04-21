import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = ROOT_DIR;
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(ROOT_DIR, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const OTP_FILE = path.join(DATA_DIR, "otp_sessions.json");
const SESSIONS_FILE = path.join(DATA_DIR, "auth_sessions.json");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");
let loadedEnv = null;
const rateWindowMs = 60 * 1000;
const rateState = new Map();

function now() {
  return Date.now();
}

async function ensureDataFiles() {
  await mkdir(DATA_DIR, { recursive: true });

  const files = [
    { file: USERS_FILE, defaultValue: [] },
    { file: OTP_FILE, defaultValue: [] },
    { file: SESSIONS_FILE, defaultValue: [] },
    { file: REPORTS_FILE, defaultValue: [] }
  ];

  for (const item of files) {
    try {
      await stat(item.file);
    } catch (_err) {
      await writeFile(item.file, JSON.stringify(item.defaultValue, null, 2), "utf8");
    }
  }
}

async function readJsonFile(file, fallback) {
  try {
    const content = await readFile(file, "utf8");
    return JSON.parse(content);
  } catch (_err) {
    return fallback;
  }
}

async function writeJsonFile(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

function normalizeMobile(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function newId(prefix) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function hashSecret(value, salt = randomBytes(12).toString("hex")) {
  const digest = pbkdf2Sync(String(value), salt, 120000, 32, "sha256").toString("hex");
  return { salt, digest };
}

function verifySecret(value, salt, digest) {
  const expected = Buffer.from(String(digest), "hex");
  const current = Buffer.from(pbkdf2Sync(String(value), String(salt), 120000, 32, "sha256").toString("hex"), "hex");
  if (expected.length !== current.length) return false;
  return timingSafeEqual(expected, current);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpSms(mobile, otp, env) {
  const accountSid = env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    return {
      delivered: false,
      provider: "demo"
    };
  }

  const toNumber = mobile.startsWith("+") ? mobile : `+91${mobile}`;
  const body = new URLSearchParams({
    To: toNumber,
    From: from,
    Body: `Your AI Comm Coach OTP is ${otp}. Valid for 5 minutes.`
  });

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMS provider error: ${text || response.status}`);
  }

  return {
    delivered: true,
    provider: "twilio"
  };
}

function getAuthToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

async function getSessionUser(req) {
  const token = getAuthToken(req);
  if (!token) return null;

  const [sessions, users] = await Promise.all([
    readJsonFile(SESSIONS_FILE, []),
    readJsonFile(USERS_FILE, [])
  ]);

  const session = sessions.find((item) => item.token === token && Number(item.expiresAt || 0) > now());
  if (!session) return null;

  const user = users.find((item) => item.id === session.userId);
  if (!user) return null;

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      registeredAt: user.registeredAt
    }
  };
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function rateKey(req, bucket) {
  return `${bucket}:${getClientIp(req)}`;
}

function checkRateLimit(req, bucket, limitPerMinute) {
  const key = rateKey(req, bucket);
  const current = rateState.get(key) || { count: 0, startAt: now() };
  if (now() - current.startAt > rateWindowMs) {
    current.count = 0;
    current.startAt = now();
  }
  current.count += 1;
  rateState.set(key, current);
  return current.count <= limitPerMinute;
}

async function handleSendOtp(body) {
  const env = await loadEnvFromFiles();
  const mobile = normalizeMobile(body.mobile);
  if (mobile.length !== 10) {
    throw new Error("Invalid mobile number");
  }

  const otp = generateOtp();
  const hash = hashSecret(otp);
  const otpRows = await readJsonFile(OTP_FILE, []);
  const freshRows = otpRows.filter((row) => !(row.mobile === mobile && Number(row.expiresAt || 0) > now()));

  freshRows.push({
    id: newId("otp"),
    mobile,
    salt: hash.salt,
    digest: hash.digest,
    createdAt: now(),
    expiresAt: now() + 5 * 60 * 1000,
    attempts: 0
  });

  await writeJsonFile(OTP_FILE, freshRows);
  const sms = await sendOtpSms(mobile, otp, env);

  return {
    success: true,
    message: sms.delivered ? "OTP sent successfully." : "OTP generated in demo mode.",
    provider: sms.provider,
    demoOtp: sms.delivered ? undefined : otp
  };
}

async function consumeOtpOrThrow(mobile, otpCode) {
  const rows = await readJsonFile(OTP_FILE, []);
  const index = rows.findIndex((row) => row.mobile === mobile && Number(row.expiresAt || 0) > now());
  if (index === -1) {
    throw new Error("OTP not found or expired");
  }

  const row = rows[index];
  const ok = verifySecret(String(otpCode || "").trim(), row.salt, row.digest);

  row.attempts = Number(row.attempts || 0) + 1;
  if (row.attempts > 5) {
    rows.splice(index, 1);
    await writeJsonFile(OTP_FILE, rows);
    throw new Error("Too many OTP attempts");
  }

  if (!ok) {
    rows[index] = row;
    await writeJsonFile(OTP_FILE, rows);
    throw new Error("Invalid OTP");
  }

  rows.splice(index, 1);
  await writeJsonFile(OTP_FILE, rows);
}

async function createSessionForUser(userId) {
  const sessions = await readJsonFile(SESSIONS_FILE, []);
  const token = randomBytes(32).toString("hex");
  sessions.push({
    id: newId("sess"),
    token,
    userId,
    createdAt: now(),
    expiresAt: now() + 30 * 24 * 60 * 60 * 1000
  });
  await writeJsonFile(SESSIONS_FILE, sessions);
  return token;
}

async function handleRegister(body) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const mobile = normalizeMobile(body.mobile);
  const otp = String(body.otp || "").trim();

  if (!name || !email || mobile.length !== 10 || !otp) {
    throw new Error("Missing required registration fields");
  }

  await consumeOtpOrThrow(mobile, otp);
  const users = await readJsonFile(USERS_FILE, []);
  const exists = users.find((u) => normalizeMobile(u.mobile) === mobile);
  if (exists) {
    throw new Error("Mobile already registered");
  }

  const user = {
    id: newId("usr"),
    name,
    email,
    mobile,
    registeredAt: now()
  };
  users.push(user);
  await writeJsonFile(USERS_FILE, users);

  const token = await createSessionForUser(user.id);
  return {
    success: true,
    token,
    user
  };
}

async function handleLogin(body) {
  const mobile = normalizeMobile(body.mobile);
  const otp = String(body.otp || "").trim();
  if (mobile.length !== 10 || !otp) {
    throw new Error("Missing mobile or OTP");
  }

  await consumeOtpOrThrow(mobile, otp);
  const users = await readJsonFile(USERS_FILE, []);
  const user = users.find((u) => normalizeMobile(u.mobile) === mobile);
  if (!user) {
    throw new Error("User not found");
  }

  const token = await createSessionForUser(user.id);
  return {
    success: true,
    token,
    user
  };
}

async function handleLogout(req) {
  const token = getAuthToken(req);
  if (!token) return { success: true };
  const sessions = await readJsonFile(SESSIONS_FILE, []);
  const filtered = sessions.filter((item) => item.token !== token);
  await writeJsonFile(SESSIONS_FILE, filtered);
  return { success: true };
}

async function saveReportForUser(userId, report) {
  const reports = await readJsonFile(REPORTS_FILE, []);
  reports.push({
    id: newId("rpt"),
    userId,
    ...report,
    createdAt: now()
  });
  await writeJsonFile(REPORTS_FILE, reports.slice(-2000));
  return { success: true };
}

async function getReportsForUser(userId) {
  const reports = await readJsonFile(REPORTS_FILE, []);
  return reports
    .filter((item) => item.userId === userId)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 100);
}

async function clearReportsForUser(userId) {
  const reports = await readJsonFile(REPORTS_FILE, []);
  const next = reports.filter((item) => item.userId !== userId);
  await writeJsonFile(REPORTS_FILE, next);
  return { success: true };
}

function parseLooseEnv(content) {
  const out = {};
  content.split(/\r?\n/).forEach((line) => {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) return;
    const eqIndex = clean.indexOf("=");
    if (eqIndex === -1) return;
    const key = clean.slice(0, eqIndex).trim();
    let value = clean.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  });
  return out;
}

async function loadKeyFromFiles() {
  const candidates = [
    path.join(ROOT_DIR, ".env"),
    path.join(ROOT_DIR, ".env.example"),
    "e:\\1. FINAL YEAR PROJECT\\.env"
  ];

  for (const file of candidates) {
    try {
      const content = await readFile(file, "utf8");
      const values = parseLooseEnv(content);
      if (values.GROQ_API_KEY) return values.GROQ_API_KEY;
      if (values.api) return values.api;
      if (values.k) return values.k;
    } catch (_err) {
      // ignore missing files
    }
  }

  return "";
}

async function loadEnvFromFiles() {
  if (loadedEnv) return loadedEnv;

  const candidates = [
    path.join(ROOT_DIR, ".env"),
    path.join(ROOT_DIR, ".env.example"),
    "e:\\1. FINAL YEAR PROJECT\\.env"
  ];

  const merged = {};
  for (const file of candidates) {
    try {
      const content = await readFile(file, "utf8");
      const parsed = parseLooseEnv(content);
      Object.keys(parsed).forEach((key) => {
        if (!(key in merged)) merged[key] = parsed[key];
      });
    } catch (_err) {
      // ignore missing files
    }
  }

  loadedEnv = merged;
  return loadedEnv;
}

function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
    "Content-Security-Policy": "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self' http://localhost:3000; frame-ancestors 'none'; base-uri 'self';",
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_err) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (__err) {
      return null;
    }
  }
}

async function callGroq(groqApiKey, systemPrompt, userPrompt) {
  const env = await loadEnvFromFiles();
  const modelName = process.env.GROQ_MODEL || env.GROQ_MODEL || "llama-3.1-8b-instant";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Groq request failed with ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text) {
  return new Set(normalizeText(text).split(" ").filter(Boolean));
}

function overlapRatio(a, b) {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (!setA.size || !setB.size) return 0;
  let common = 0;
  setA.forEach((token) => {
    if (setB.has(token)) common += 1;
  });
  return common / Math.min(setA.size, setB.size);
}

async function regenerateSuggestions(groqApiKey, userText, mode) {
  const systemPrompt = [
    "You are an English speaking coach.",
    "Return ONLY valid JSON in this format:",
    "{\"suggestions\":[\"...\",\"...\",\"...\"]}",
    "Give 3 distinct alternatives:",
    "1) corrected grammar",
    "2) professional tone",
    "3) short confident tone",
    "Do NOT copy the original sentence."
  ].join(" ");

  const userPrompt = JSON.stringify({ mode, userText });
  const text = await callGroq(groqApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(text);
  if (!parsed || !Array.isArray(parsed.suggestions)) return [];
  return parsed.suggestions.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 3);
}

async function handleTurn(body, groqApiKey) {
  const { mode, userText, interviewContext, customConversationType, history } = body;

  const systemPrompt = [
    "You are an English communication coach.",
    "Return ONLY valid JSON.",
    "Format: {\"reply\":string,\"suggestions\":[string,string,string]}",
    "Suggestions must be different and natural, not repetitive.",
    "Keep each suggestion under 20 words.",
    "Never copy the user's sentence verbatim in reply.",
    "Avoid repeating your own previous reply ideas from history.",
    "Do not repeat a question already present in history assistant messages.",
    "If the user answer is off-topic, refusal, or not addressing the asked question, say exactly: 'Your answer did not address the question.' then guide a better answer.",
    "If customConversationType is provided, align your response and next question strictly with it.",
    "If interviewContext.jd is provided, generate role-specific and JD-specific interview follow-ups.",
    "In Interview mode: give brief coaching + ask the next interview question.",
    "In Casual/Professional/Dating mode: reply in 2 to 4 sentences and end with a fresh follow-up question."
  ].join(" ");

  const userPrompt = JSON.stringify({
    mode,
    userText,
    interviewContext,
    customConversationType,
    history: Array.isArray(history) ? history.slice(-8) : []
  });

  const text = await callGroq(groqApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(text);

  if (!parsed || !Array.isArray(parsed.suggestions) || typeof parsed.reply !== "string") {
    throw new Error("Invalid AI format from Groq turn response");
  }

  const suggestions = parsed.suggestions
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  let cleanedSuggestions = suggestions.filter((item) => overlapRatio(item, userText) < 0.9);
  if (cleanedSuggestions.length < 2) {
    const regenerated = await regenerateSuggestions(groqApiKey, userText, mode);
    const merged = [...cleanedSuggestions, ...regenerated];
    const unique = [];
    merged.forEach((item) => {
      const key = normalizeText(item);
      if (!key) return;
      if (normalizeText(userText) === key) return;
      if (!unique.some((u) => normalizeText(u) === key)) unique.push(item);
    });
    cleanedSuggestions = unique.slice(0, 3);
  }

  return {
    reply: parsed.reply.trim(),
    suggestions: cleanedSuggestions
  };
}

async function handleOpening(body, groqApiKey) {
  const { mode, interviewContext, customConversationType, history } = body;

  const systemPrompt = [
    "You are an English communication coach.",
    "Return ONLY valid JSON in format: {\"opening\":string}.",
    "Opening should be natural and non-repetitive.",
    "If mode is Interview, ask one clear first interview question.",
    "If interviewContext.jd exists, first question must be directly tied to that JD.",
    "If customConversationType exists, opener must follow that exact scenario.",
    "If mode is Casual/Professional/Dating, start conversation with a fresh question not present in history."
  ].join(" ");

  const userPrompt = JSON.stringify({
    mode,
    interviewContext,
    customConversationType,
    history: Array.isArray(history) ? history.slice(-8) : []
  });

  const text = await callGroq(groqApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(text);
  if (!parsed || typeof parsed.opening !== "string") {
    throw new Error("Invalid AI format from Groq opening response");
  }
  return { opening: parsed.opening.trim() };
}

async function handleAnswerTips(body, groqApiKey) {
  const { mode, question, interviewContext, customConversationType, history } = body;

  const systemPrompt = [
    "You are an expert communication coach.",
    "Return ONLY valid JSON in format: {\"tips\":[string,string,string,string]}.",
    "Tips must explain what to include in the answer for the given question.",
    "Use concise actionable lines, each under 18 words.",
    "If JD/context is provided, make tips context-specific.",
    "Do not repeat the question text."
  ].join(" ");

  const userPrompt = JSON.stringify({
    mode,
    question,
    interviewContext,
    customConversationType,
    history: Array.isArray(history) ? history.slice(-8) : []
  });

  const text = await callGroq(groqApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(text);
  if (!parsed || !Array.isArray(parsed.tips)) {
    throw new Error("Invalid AI format from Groq answer tips response");
  }

  const tips = parsed.tips
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 4);

  return { tips };
}

async function handleReport(body, groqApiKey) {
  const { mode, entries, customConversationType, interviewContext } = body;

  const systemPrompt = [
    "You are an expert communication evaluator.",
    "Return ONLY valid JSON.",
    "Format:",
    "{",
    "\"grammar\":number,\"fluency\":number,\"confidence\":number,",
    "\"tips\":string,",
    "\"report\":{",
    "\"summary\":string,",
    "\"totals\":{\"responses\":number,\"words\":number,\"averageWordsPerSentence\":number,\"fillerWords\":number},",
    "\"strengths\":[string],\"improvements\":[string],\"examples\":[{\"from\":string,\"to\":string}]",
    "}",
    "}"
  ].join(" ");

  const userPrompt = JSON.stringify({
    mode,
    customConversationType,
    interviewContext,
    entries: Array.isArray(entries) ? entries.slice(-20) : []
  });

  const text = await callGroq(groqApiKey, systemPrompt, userPrompt);
  const parsed = extractJson(text);

  if (!parsed || typeof parsed !== "object" || !parsed.report) {
    throw new Error("Invalid AI format from Groq report response");
  }

  return parsed;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

async function serveStatic(req, res) {
  let requestPath = req.url === "/" ? "/index.html" : req.url || "/index.html";
  requestPath = requestPath.split("?")[0];

  const safePath = path.normalize(path.join(PUBLIC_DIR, requestPath));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const fileStat = await stat(safePath);
    if (fileStat.isDirectory()) {
      const indexPath = path.join(safePath, "index.html");
      const file = await readFile(indexPath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(file);
      return;
    }

    const file = await readFile(safePath);
    res.writeHead(200, {
      "Content-Type": contentType(safePath),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer"
    });
    res.end(file);
  } catch (_err) {
    sendJson(res, 404, { error: "Not found" });
  }
}

const groqApiKeyPromise = loadKeyFromFiles();

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      });
      res.end();
      return;
    }

    const groqApiKey = process.env.GROQ_API_KEY || (await groqApiKeyPromise);

    if (req.method === "POST" && req.url === "/api/auth/send-otp") {
      if (!checkRateLimit(req, "otp", 8)) {
        sendJson(res, 429, { error: "Too many OTP requests. Try again later." });
        return;
      }
      const body = await readBody(req);
      const data = await handleSendOtp(body);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && req.url === "/api/auth/register") {
      if (!checkRateLimit(req, "auth-register", 12)) {
        sendJson(res, 429, { error: "Too many requests. Try again later." });
        return;
      }
      const body = await readBody(req);
      const data = await handleRegister(body);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && req.url === "/api/auth/login") {
      if (!checkRateLimit(req, "auth-login", 20)) {
        sendJson(res, 429, { error: "Too many requests. Try again later." });
        return;
      }
      const body = await readBody(req);
      const data = await handleLogin(body);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "GET" && req.url === "/api/auth/me") {
      const session = await getSessionUser(req);
      if (!session) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      sendJson(res, 200, { success: true, user: session.user });
      return;
    }

    if (req.method === "POST" && req.url === "/api/auth/logout") {
      const data = await handleLogout(req);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && req.url === "/api/coach/turn") {
      if (!checkRateLimit(req, "coach-turn", 60)) {
        sendJson(res, 429, { error: "Rate limit exceeded." });
        return;
      }
      if (!groqApiKey) {
        sendJson(res, 500, { error: "Missing GROQ_API_KEY" });
        return;
      }
      const body = await readBody(req);
      const data = await handleTurn(body, groqApiKey);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && req.url === "/api/coach/opening") {
      if (!checkRateLimit(req, "coach-opening", 40)) {
        sendJson(res, 429, { error: "Rate limit exceeded." });
        return;
      }
      if (!groqApiKey) {
        sendJson(res, 500, { error: "Missing GROQ_API_KEY" });
        return;
      }
      const body = await readBody(req);
      const data = await handleOpening(body, groqApiKey);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && req.url === "/api/coach/answer-tips") {
      if (!checkRateLimit(req, "coach-tips", 60)) {
        sendJson(res, 429, { error: "Rate limit exceeded." });
        return;
      }
      if (!groqApiKey) {
        sendJson(res, 500, { error: "Missing GROQ_API_KEY" });
        return;
      }
      const body = await readBody(req);
      const data = await handleAnswerTips(body, groqApiKey);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && req.url === "/api/coach/report") {
      if (!checkRateLimit(req, "coach-report", 30)) {
        sendJson(res, 429, { error: "Rate limit exceeded." });
        return;
      }
      if (!groqApiKey) {
        sendJson(res, 500, { error: "Missing GROQ_API_KEY" });
        return;
      }
      const body = await readBody(req);
      const data = await handleReport(body, groqApiKey);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && req.url === "/api/reports/save") {
      const auth = await getSessionUser(req);
      if (!auth) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const body = await readBody(req);
      const payload = body?.report || null;
      if (!payload) {
        sendJson(res, 400, { error: "Missing report payload" });
        return;
      }
      const data = await saveReportForUser(auth.user.id, payload);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "GET" && req.url === "/api/reports/list") {
      const auth = await getSessionUser(req);
      if (!auth) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const reports = await getReportsForUser(auth.user.id);
      sendJson(res, 200, { success: true, reports });
      return;
    }

    if (req.method === "POST" && req.url === "/api/reports/clear") {
      const auth = await getSessionUser(req);
      if (!auth) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const data = await clearReportsForUser(auth.user.id);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, {
        status: "ok",
        timestamp: now(),
        uptimeSec: Math.round(process.uptime())
      });
      return;
    }

    await serveStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Internal server error" });
  }
});
ensureDataFiles()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`AI Comm Coach running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize server data store:", err.message);
    process.exit(1);
  });
