const API_BASE =
  window.location.port === "3000"
    ? ""
    : "http://localhost:3000";

async function postJson(path, payload) {
  if (window.location.protocol === "file:") {
    throw new Error("Open app via http://localhost:3000, not file://");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json();
}

export async function requestAiTurn(payload) {
  return postJson("/api/coach/turn", payload);
}

export async function requestAiOpening(payload) {
  return postJson("/api/coach/opening", payload);
}

export async function requestAnswerTips(payload) {
  return postJson("/api/coach/answer-tips", payload);
}

export async function requestDetailedReport(payload) {
  return postJson("/api/coach/report", payload);
}
