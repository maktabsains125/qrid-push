// /shared/docs-absence/app.js
// Lock to signed-in users only and wire up Close button.

(async function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  // ===== Soft auth =====
let who = (window.Auth && Auth.who && Auth.who()) || null;

if (!who) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  who = (window.Auth && Auth.who && Auth.who()) || null;
}

// Continue even if who is still null.

  // ===== Close button =====
  const closeBtn = document.getElementById("closeBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      // Prefer going back if there is history
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.replace("/");
      }
    });
  }

  // No extra JS needed for the D1–D4 / D5 buttons,
  // they are just normal links styled as buttons.
})();
