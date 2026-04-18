/* /shared/attendance/holiday/holiday.js
 * Holiday editor — TABLE REMOVED
 *
 * 
 * ✅ Backend action=getLogs
 * ✅ logDaily shows last change from LOGS!B8 (DD/MMM/YYYY)
 * ✅ logBox shows monthly timestamps from LOGS!B2:B7
 * ✅ refresh logs after apply
 * ✅ statusMsg animated "Please wait", loops until loading completes
 */

(function () {
  "use strict";

  const CLOSE_URL = "/shared/attendance/reports/reports.html";
  const API = "/.netlify/functions/holiday";

  const EDIT_URL =
    "https://docs.google.com/spreadsheets/d/1ISHYJSU682NnPWzj4Lu6uIy3-YKo9Z4VRVoA8AneRMA/edit?gid=1491451005#gid=1491451005";

  const el = {
    html: document.documentElement,
    xBtn: document.getElementById("xBtn"),
    logBox: document.getElementById("logBox"),
    roleMessage: document.getElementById("roleMessage"),

    btnDaily: document.getElementById("btnDaily"),
    monthlyBtn: document.getElementById("monthlyBtn"),
    btnEdit: document.getElementById("btnEdit"),

    level: document.getElementById("level"),
    logDaily: document.getElementById("logDaily"),
    statusMsg: document.getElementById("statusMsg"),
	statusText: document.getElementById("statusText"),
    statusDots: document.getElementById("statusDots"),

  };

  // ---------- helpers ----------
  function normRole(x) { return String(x || "").toUpperCase().trim(); }
  function who() { return (window.Auth && typeof Auth.who === "function") ? Auth.who() : null; }

  function setRoleMessage(text) {
    if (!el.roleMessage) return;
    el.roleMessage.textContent = text || "";
  }

  function setLogDailyText(text) {
    if (!el.logDaily) return;
    el.logDaily.textContent = text || "";
  }

  function setMonthlyLogBoxText(text) {
    if (!el.logBox) return;
    el.logBox.textContent = text || "";
  }

  // ===== wait animation (text only) =====
  let waitTimer = null;
let waitStep = 0;

function startWaitAnimation(baseText = "Please wait") {
  if (!el.statusMsg || !el.statusText || !el.statusDots) return;

  stopWaitAnimation();
  el.statusMsg.classList.remove("hidden");
  el.statusText.textContent = baseText;
  waitStep = 0;

  waitTimer = setInterval(() => {
    const dots = ["", " .", " . .", " . . ."][waitStep % 4];
    el.statusDots.textContent = dots.padEnd(3, " "); // keeps width stable
    waitStep++;
  }, 450);
}

function stopWaitAnimation() {
  if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }
  if (el.statusDots) el.statusDots.textContent = "   ";
}

 
  // =======================================
  
  function hideStatus() {
    stopWaitAnimation();
    if (!el.statusMsg) return;
    el.statusMsg.classList.add("hidden");
  }

  async function api(payload) {
    const resp = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    return resp.json();
  }

  function parseAnyDate(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;

    const ms = Date.parse(s);
    if (!isNaN(ms)) return new Date(ms);

    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const d = parseInt(m[3], 10);
      const hh = parseInt(m[4] || "0", 10);
      const mm = parseInt(m[5] || "0", 10);
      const ss = parseInt(m[6] || "0", 10);
      return new Date(y, mo, d, hh, mm, ss);
    }
    return null;
  }

  function formatDD_MMM_YYYY(dt) {
    const s = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const parts = s.split(" ");
    if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;

    const dd = String(dt.getDate()).padStart(2, "0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mmm = months[dt.getMonth()] || "Jan";
    const yyyy = String(dt.getFullYear());
    return `${dd}/${mmm}/${yyyy}`;
  }

  function formatLine(value) {
    const dt = parseAnyDate(value);
    if (!dt) return "—";

    const dmy = formatDD_MMM_YYYY(dt);
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${dmy} ${hh}:${mm}`;
  }

  function buildMonthlyLines(monthly) {
    const m = monthly || {};
    return [
      `Year 7 - ${formatLine(m["7"])}`,
      `Year 8 - ${formatLine(m["8"])}`,
      `Year 9 - ${formatLine(m["9"])}`,
      `Year 10 - ${formatLine(m["10"])}`,
      `Year 12 - ${formatLine(m["12"])}`,
      `Year 13 - ${formatLine(m["13"])}`,
    ].join("\n");
  }

  // ---------- gate ----------
  async function gateAccessOrRedirect() {
    const w = who();
    if (!w) {
      setRoleMessage("Not signed in.");
      location.href = CLOSE_URL;
      return false;
    }

    const role = normRole(w.role);
    if (role === "CODER") return true;

    if (role === "REGIS") {
      try {
        const res = await api({ action: "gate" });
        const gate = res && Number(res.gate) === 1 ? 1 : 0;
        if (gate === 1) return true;

        setRoleMessage("REGIS access is currently OFF (REPORTS BTN!C7 = 0).");
        location.href = CLOSE_URL;
        return false;
      } catch (_) {
        setRoleMessage("Gate check failed.");
        location.href = CLOSE_URL;
        return false;
      }
    }

    setRoleMessage("Access denied (REGIS or CODER only).");
    location.href = CLOSE_URL;
    return false;
  }

  // ---------- load logs ----------
  async function loadLogs() {
  startWaitAnimation("Please wait"); 

  setLogDailyText("Last change - —");
  setMonthlyLogBoxText(
    [
      "Year 7 - —",
      "Year 8 - —",
      "Year 9 - —",
      "Year 10 - —",
      "Year 12 - —",
      "Year 13 - —",
    ].join("\n")
  );

  try {
    const res = await api({ action: "getLogs" });
    if (!res || !res.ok) return;

    const dailyDt = parseAnyDate(res.daily && res.daily.dateValue);
    if (dailyDt) setLogDailyText(`Last change - ${formatDD_MMM_YYYY(dailyDt)}`);

    setMonthlyLogBoxText(buildMonthlyLines(res.monthly));
  } catch (_) {
  } finally {
    hideStatus(); // 
  }
}


  // ---------- actions ----------
  async function applyTo(type) {
    startWaitAnimation("Please wait");

    const level = el.level ? el.level.value : "7";

    if (String(type).toLowerCase() === "daily") {
      setLogDailyText("Last change - Running…");
    } else {
      setMonthlyLogBoxText("Running…");
    }

    try {
      const res = await api({ action: "apply", type, level });

      if (res && res.ok) {
        if (res.daily && res.daily.dateValue) {
          const d = parseAnyDate(res.daily.dateValue);
          if (d) setLogDailyText(`Last change - ${formatDD_MMM_YYYY(d)}`);
        }
        if (res.monthly) {
          setMonthlyLogBoxText(buildMonthlyLines(res.monthly));
        } else {
          await loadLogs();
        }
      } else {
        await loadLogs();
      }
    } catch (_) {
      await loadLogs();
    } finally {
      hideStatus();
    }
  }

  // ---------- kebab ----------
  async function initKebab() {
    if (!window.LeftKebab || typeof window.LeftKebab.init !== "function") return;

    try { await window.LeftKebab.guard({ key: "holiday", redirectTo: CLOSE_URL }); } catch (_) {}
    try { await window.LeftKebab.init(); } catch (_) {}
  }

  // ---------- events ----------
  function hookEvents() {
    if (el.xBtn) el.xBtn.addEventListener("click", () => location.href = CLOSE_URL);

    if (el.btnDaily) el.btnDaily.addEventListener("click", () => applyTo("daily"));
    if (el.monthlyBtn) el.monthlyBtn.addEventListener("click", () => applyTo("monthly"));

    if (el.btnEdit) {
      el.btnEdit.addEventListener("click", () => {
        window.open(EDIT_URL, "_blank", "noopener,noreferrer");
      });
    }
  }

  // ---------- init ----------
  async function init() {
    const ok = await gateAccessOrRedirect();
    if (!ok) return;

    el.html.style.visibility = "visible";
    startWaitAnimation("Please wait");

    try {
      await initKebab();
      hookEvents();
      await loadLogs();
    } finally {
      hideStatus();
    }
  }

  init();
})();
