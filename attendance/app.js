/* /shared/attendance/app.js — Attendance main page (role-aware X, no flash) */

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // ===== ALLOWED ROLES ONLY =====
  // Only ADMIN, REGIS, CODER, WELFARE may use this page
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED_ROLES = new Set(["ADMIN", "REGIS", "CODER", "WELFARE"]);

  if (!ALLOWED_ROLES.has(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return;
  }

  // ===== Helpers =====
  const $ = (s, root = document) => root.querySelector(s);

  // ===== Show current year =====
  const yy = $("#yy");
  if (yy) yy.textContent = new Date().getFullYear();

  // ===== Close (X) button — same behaviour as Profiles closeTop =====
  (function setupCloseButtons() {
    const closeEls = Array.from(document.querySelectorAll("#closeBtn, #closeTop"));
    if (!closeEls.length) return;

    closeEls.forEach((oldBtn) => {
      const btn = oldBtn.cloneNode(true);
      oldBtn.replaceWith(btn);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        goBackToRole();
      });
    });
  })();

  // ===== Attendance button links =====
  const DISABLED = new Set([
    // "btnTrends",
    // "btnLetters",
  ]);

  document.querySelectorAll(".linkBtn").forEach((el) => {
    if (DISABLED.has(el.id)) {
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
      });
    }
  });

  // ===== Role-based redirection via Auth (aligned with other pages) =====
  function goBackToRole() {
    try {
      const roleFromAuth =
        (window.Auth && typeof Auth.who === "function" && Auth.who()?.role) || "";
      const roleFromLS = localStorage.getItem("ms_role") || "";

      const r = String(roleFromAuth || roleFromLS).toUpperCase().trim();

      const dest =
        (window.Auth && typeof Auth.routeFor === "function" && r)
          ? Auth.routeFor(r)
          : (r ? `/roles/${r.toLowerCase()}` : "/");

      location.replace(dest);
    } catch (err) {
      console.error("goBackToRole error:", err);
      location.replace("/");
    }
  }
})();
