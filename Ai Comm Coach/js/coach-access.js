import { fetchCurrentUser, logoutUser } from "./auth-client.js";

(async () => {
  const user = await fetchCurrentUser().catch(() => null);
  if (!user?.name) {
    window.location.href = "./index.html";
    return;
  }

  const userWelcome = document.getElementById("userWelcome");
  if (userWelcome) {
    userWelcome.textContent = `Welcome, ${user.name}`;
  }
})();

const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", async () => {
  await logoutUser();
  window.location.href = "./index.html";
});

const profileBtn = document.getElementById("profileBtn");
profileBtn?.addEventListener("click", () => {
  window.location.href = "./profile.html";
});
