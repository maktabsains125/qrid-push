// /shared/docs-absence/app.js
// Lock to signed-in users only and wire up Close button.

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

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
