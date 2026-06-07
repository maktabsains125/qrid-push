/* shared/camera/greetings-kebab.js */

(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  ready(() => {
    const who = (window.Auth && Auth.who && Auth.who()) || null;
    const role = String(who?.role || "").toUpperCase().trim();

    const $ = (id) => document.getElementById(id);

    // ===== MENU =====
    const kebabBtn   = $("kebabBtn");
    const overlay    = $("overlay");
    const overlayDim = $("overlayDim");
    const panelClose = $("panelClose");

    // ===== BUTTONS =====
    const goBook  = $("goBook");
    const goMine  = $("goMine");
    const goAdmin = $("goAdmin");
    const goSS    = $("goSS");

    const SS_URL =
      "https://docs.google.com/spreadsheets/d/1VTIbgepfUYEW3cfPGTDirv_pMyKjv2EJCnPl6S5Km0Q/edit?usp=sharing";

    // ===== SHOW/HIDE ADMIN ITEMS =====
    const isAdminOrCoder =
      role === "ADMIN" || role === "CODER";

    if (goAdmin) {
      goAdmin.hidden = !isAdminOrCoder;
    }

    if (goSS) {
      goSS.hidden = !isAdminOrCoder;
    }

    // ===== MENU OPEN/CLOSE =====
    function openMenu() {
      if (overlay) overlay.hidden = false;
    }

    function closeMenu() {
      if (overlay) overlay.hidden = true;
    }

    kebabBtn?.addEventListener("click", () => {
      if (!overlay) return;
      overlay.hidden ? openMenu() : closeMenu();
    });

    overlayDim?.addEventListener("click", closeMenu);
    panelClose?.addEventListener("click", closeMenu);

    // ===== NAVIGATION =====
    goBook?.addEventListener("click", () => {
      location.assign("/shared/camera/greetings/bookings.html");
    });

    goMine?.addEventListener("click", () => {
      location.assign("/shared/camera/schedule/my-schedule.html");
    });

    goAdmin?.addEventListener("click", () => {
      location.assign("/shared/camera/admin/admin-book.html");
    });

    goSS?.addEventListener("click", () => {
      window.open(SS_URL, "_blank");
    });

    // Start closed
    closeMenu();
  });
})();
