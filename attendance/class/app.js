/* /shared/monthly-reports/app.js — Monthly Reports page router */

// ===== LOCK to signed in user only =====
(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // ===== ROLE GATE: block GENERAL, FT, WELFARE, HEP =====
  const role = String(who.role || "").toUpperCase().trim();
  const BLOCKED = ["GENERAL", "FT", "HEP",""];

  if (BLOCKED.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return; // stop everything else
  }

  // ===== ROUTE SETTINGS =====
  const UNDER85_PAGE = "/shared/attendance/class/low-attend/low-attend.html";
  const FULL100_PAGE = "/shared/attendance/class/full-attend/full-attend.html";

  // Direct Google Drive links for each level
  const DRIVE_LINKS = {
    "7":  "https://drive.google.com/drive/folders/1D8eX42C42-rl3ig0XZWL9cGhHTXpy9Gb?usp=sharing",
    "8":  "https://drive.google.com/drive/folders/1klAnpauL-EjBjGQuzCuk0xgHioYC4Xn6?usp=sharing",
    "9":  "https://drive.google.com/drive/folders/1nqRPJ3xJfaJ2ys7cX309H-twib0eZMcG?usp=sharing",
    "10": "https://drive.google.com/drive/folders/1ae5GtNZ_KK4jFzbL8eVNs7eIKFZdvwuY?usp=sharing",
    "12": "https://drive.google.com/drive/folders/1MbCmY91Wuxwm7ArJ4VcAVc2SJPtbHxBP?usp=sharing",
    "13": "https://drive.google.com/drive/folders/1jICqwZOtp6vjL9XROdlF-RmWj9WJddPY?usp=sharing"
  };

  // ===== DOM =====
  const $ = (s, root = document) => root.querySelector(s);
  const yy = $("#yy");
  const grid = $(".levelGrid");
  const closeTop = $("#closeTop");
  const closeLevel = $("#closeLevel");

  // ===== INIT =====
  // Show current year in header
  if (yy) yy.textContent = new Date().getFullYear();

  // Handle button clicks for the main grid
  if (grid) {
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".levelBtn");
      if (!btn) return;

      const data = (btn.dataset.level || "").trim();
      const label = (btn.textContent || "").trim();

      // 1) Most explicit: respect data-target if provided
      const target = btn.dataset.target;
      if (target) {
        navigate(target);
        return;
      }

      // 2) Special buttons (Low attendance / Full attendance)
      if (/85\s*%/i.test(data) || /below/i.test(label)) {
        navigate(UNDER85_PAGE);
        return;
      }
      if (/100\s*%|full\s*attendance/i.test(label)) {
        navigate(FULL100_PAGE);
        return;
      }

      // 3) Year levels (7–13) → open Drive folder in a new tab
      const level = extractLevel(data || label);
      if (DRIVE_LINKS[level]) {
        window.open(DRIVE_LINKS[level], "_blank", "noopener,noreferrer");
        return;
      }

      console.warn("Unrecognized button:", { data, label, btn });
    });
  }

  // ===== Close (X) buttons: go back to Attendance index =====
  [closeTop, closeLevel].forEach((el) => {
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      location.href = "/shared/attendance/index.html";
    });
  });

  // ===== Helpers =====
  function navigate(url) {
    // Use assign (keep back-button path), not replace
    location.assign(url);
  }

  function extractLevel(s) {
    const m = String(s).match(/^\s*(\d{1,2})\b/);
    return m ? m[1] : "";
  }
})();
