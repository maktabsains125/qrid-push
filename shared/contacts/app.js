/* /shared/contacts/app.js — Attendance main page (role-aware X, no loop) */

// ===== LOCK to signed in user only =====
(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // ===== ROLE ALLOW-LIST: only ADMIN, REGIS, CODER =====
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED_ROLES = ["ADMIN", "REGIS", "CODER"];

  if (!ALLOWED_ROLES.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return; // stop everything else
  }

  // ===== Helpers =====
  const $ = (s, root = document) => root.querySelector(s);

  // ===== Show current year =====
  const yy = $("#yy");
  if (yy) yy.textContent = new Date().getFullYear();

  // ===== Close (X) button =====
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest("#closeBtn, #closeTop");
      if (!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      goBackToRole();
    },
    true
  );

  // ===== Contacts button links =====
  const DISABLED = new Set([]); // none disabled

  document.querySelectorAll(".linkBtn").forEach((el) => {
    if (DISABLED.has(el.id)) {
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
      el.addEventListener("click", (e) => e.preventDefault());
    }
    // enabled links just use their native href navigation
  });

  // ===== Role-based redirection via Auth (from login-dom-lite) =====
  function goBackToRole() {
    try {
      const roleFromWho =
        (window.Auth && typeof Auth.who === "function" && Auth.who()?.role) || "";
      const roleFromLoad =
        (window.Auth && typeof Auth.load === "function" && Auth.load()?.role) || "";
      const role = String(roleFromWho || roleFromLoad).toUpperCase().trim();

      const dest =
        (window.Auth && typeof Auth.routeFor === "function" && role)
          ? Auth.routeFor(role)
          : role
          ? `/roles/${role.toLowerCase()}`
          : "/";

      location.replace(dest); // avoid history loop
    } catch (err) {
      console.error("goBackToRole error:", err);
      location.replace("/");
    }
  }
})();
