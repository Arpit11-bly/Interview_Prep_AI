import { fetchCurrentUser, listSessionReports, clearSessionReports } from "./auth-client.js";

function formatDate(ts) {
  const value = Number(ts || Date.now());
  return new Date(value).toLocaleString();
}

function renderHistory(reports) {
  const host = document.getElementById("reportHistory");

  if (!reports.length) {
    host.innerHTML = "<p class='landing-status'>No reports yet. Complete a session to generate one.</p>";
    return;
  }

  host.innerHTML = reports
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .map((item) => {
      const scoreLine = `Grammar ${item?.scores?.grammar ?? 0} | Fluency ${item?.scores?.fluency ?? 0} | Confidence ${item?.scores?.confidence ?? 0}`;
      const summary = item?.summary || "Session completed.";
      const scenario = item?.customConversationType || "General";
      const interviewCtx = item?.interviewContext?.role
        ? `${item?.interviewContext?.role} @ ${item?.interviewContext?.company || "Company"}`
        : "General";
      const convo = Array.isArray(item?.conversation) ? item.conversation : [];
      const convoHtml = convo
        .map((row) => `<p><strong>Q:</strong> ${row.aiQuestion || "-"}<br><strong>Your Answer:</strong> ${row.user || "-"}<br><strong>Better Answer:</strong> ${row.betterAnswer || "-"}</p>`)
        .join("");

      return `
        <article class="history-item">
          <p class="label">${formatDate(item.timestamp)} | ${item.mode || "Practice"}</p>
          <p><strong>Scenario:</strong> ${scenario}</p>
          <p><strong>Interview Context:</strong> ${interviewCtx}</p>
          <p><strong>${scoreLine}</strong></p>
          <p>${summary}</p>
          <details>
            <summary>View Full Conversation & Suggestions</summary>
            <div class="history-detail">${convoHtml || "<p>No conversation stored.</p>"}</div>
          </details>
        </article>
      `;
    })
    .join("");
}

(async () => {
  const user = await fetchCurrentUser().catch(() => null);
  if (!user?.name) {
    window.location.href = "./index.html";
    return;
  }

  const title = document.getElementById("profileName");
  title.textContent = `${user.name}'s Session Reports`;
  const reports = await listSessionReports().catch(() => []);
  renderHistory(reports);

  const clearBtn = document.getElementById("clearReportsBtn");
  clearBtn?.addEventListener("click", async () => {
    await clearSessionReports().catch(() => {});
    renderHistory([]);
  });
})();
