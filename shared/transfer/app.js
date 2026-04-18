/* /shared/attendance/app.js — Attendance main page (role-aware)
 * UPDATE: btnTranspr time-lock (Brunei time)
 * - Disabled daily from 05:00 to 15:00 (inclusive of 05:00, exclusive of 15:01)
 * - Enabled from 15:01 to 04:59 next day
 * - EXCEPT Fridays + Sundays: enabled all day
 * - Still only visible/usable for REGIS + CODER (ADMIN removed)
 */

// ===== LOCK to signed in user only =====
(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // ===== ROLE ALLOW-LIST to access THIS PAGE at all =====
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED_ROLES = ["CODER", "ADMIN", "WELFARE", "REGIS"];

  if (!ALLOWED_ROLES.includes(role)) {
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

  // ===== Shared disable() — matches Profiles disabled style =====
  function disable(el, yes = true) {
    if (!el) return;

    el.setAttribute("aria-disabled", String(yes));
    el.classList.toggle("disabled", yes);

    if (el.tagName === "BUTTON") {
      el.disabled = yes;
    } else if (el.tagName === "A") {
      el.tabIndex = yes ? -1 : 0;
      if (yes) {
        el.addEventListener(
          "click",
          (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          },
          { once: true }
        );
      }
    }
  }

  // ===== Brunei time helper (Asia/Brunei) =====
  function getBruneiParts_() {
    // Uses Intl so it works even if device timezone is wrong
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Brunei",
      weekday: "short", // "Mon", "Tue", ...
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const parts = fmt.formatToParts(new Date());
    const get = (type) => (parts.find(p => p.type === type)?.value || "");

    const weekday = get("weekday");        // "Fri", "Sun", etc
    const hour = parseInt(get("hour"), 10) || 0;
    const minute = parseInt(get("minute"), 10) || 0;

    return { weekday, hour, minute };
  }

  // Enabled full day if Fri or Sun (Brunei)
  // Otherwise disabled from 05:00 to 15:00, enabled from 15:01 to 04:59
  function isTransAllowedNow_() {
    const { weekday, hour, minute } = getBruneiParts_();

    if (weekday === "Fri" || weekday === "Sun") return true;

    // minutes since midnight
    const mins = hour * 60 + minute;

    // disabled window: 05:00 (300) through 15:00 (900)
    // enabled starts at 15:01 (901)
    const DISABLE_START = 5 * 60;      // 300
    const DISABLE_END   = 15 * 60;     // 900 (15:00)

    if (mins >= DISABLE_START && mins <= DISABLE_END) return false;
    return true;
  }

  // ===== Button Role Rules =====
  const btnTranspr = document.getElementById("btnTranspr");

  // Only REGIS + CODER allowed (ADMIN removed)
  const TRANS_ALLOWED = ["REGIS", "CODER"];

  function applyTransprLock_() {
    if (!btnTranspr) return;

    // Role gate first
    if (!TRANS_ALLOWED.includes(role)) {
      disable(btnTranspr, true);
      return;
    }

    // Time gate
    const allowedNow = isTransAllowedNow_();
    disable(btnTranspr, !allowedNow);
  }

  applyTransprLock_();

  // Keep it correct if page stays open (checks every 30s, no animations)
  setInterval(applyTransprLock_, 30 * 1000);

  // ===== Role-based redirection =====
  function goBackToRole() {
    try {
      const roleFromWho =
        (window.Auth && typeof Auth.who === "function" && Auth.who()?.role) || "";
      const roleFromLoad =
        (window.Auth && typeof Auth.load === "function" && Auth.load()?.role) || "";
      const r = String(roleFromWho || roleFromLoad).toUpperCase().trim();

      const dest =
        (window.Auth && typeof Auth.routeFor === "function" && r)
          ? Auth.routeFor(r)
          : r
          ? `/roles/${r.toLowerCase()}`
          : "/";

      location.replace(dest);
    } catch (err) {
      console.error("goBackToRole error:", err);
      location.replace("/");
    }
  }
})();
