/* /shared/attendance/add-cls/add-cls.js
 * Add classes to DB (REGIS / CODER only)
 */

(() => {
  "use strict";

  // Netlify proxy to GAS
  const API_URL = "/.netlify/functions/add-cls";
  const ALLOWED = new Set(["REGIS", "CODER"]);

  // New offset
  const LEVEL_BATCHYEAR_OFFSET = {
    7: 0,
    8: 1,
    9: 2,
    10: 3,
    12: 4,
    13: 5,
  };

  const $id = (id) => document.getElementById(id);

  function routeDenied(role) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    location.replace(dest);
  }

  function nowStamp() {
    const d = new Date();
    return (
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0") + ":" +
      String(d.getSeconds()).padStart(2, "0")
    );
  }

  function logLine(box, msg) {
    if (!box) return;
    box.textContent += `[${nowStamp()}] ${msg}\n`;
    box.scrollTop = box.scrollHeight;
  }

  function calcBatchYear(academicYear, level) {
    const ay = Number(academicYear);
    const lv = Number(level);

    if (!Number.isFinite(ay) || !Number.isFinite(lv)) return "";
    if (!Object.prototype.hasOwnProperty.call(LEVEL_BATCHYEAR_OFFSET, lv)) return "";

    return String(ay - LEVEL_BATCHYEAR_OFFSET[lv]);
  }

  function syncBatchYear(yearSel, levelSel, batchSel) {
    if (!yearSel || !levelSel || !batchSel) return;

    const batchYear = calcBatchYear(yearSel.value, levelSel.value);
    batchSel.value = batchYear;
    batchSel.setAttribute("data-autofilled", "true");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const roleMessageEl = $id("roleMessage");
    const xBtn = $id("xBtn");

    const yearSel  = $id("yearSel");
    const levelSel = $id("levelSel");
    const batchSel = $id("batchSel");
    const addBtn   = $id("addBtn");
    const logBox   = $id("logBox");

    /* =========================
       ✅ INIT LEFT KEBAB
       ========================= */
    if (window.LeftKebab && typeof LeftKebab.init === "function") {
      LeftKebab.init();
    }

    /* =========================
       X → back to reports page
       ========================= */
    if (xBtn) {
      xBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        location.href = "/shared/attendance/reports/reports.html";
      });
    }

    /* =========================
       AUTH GATE
       ========================= */
    const who = window.Auth && typeof Auth.who === "function" ? Auth.who() : null;
    if (!who) {
      location.replace("/");
      return;
    }

    const role = String(who.role || "").toUpperCase().trim();

    if (!ALLOWED.has(role)) {
      if (roleMessageEl) roleMessageEl.textContent = "Access denied.";
      routeDenied(role);
      return;
    }

    if (roleMessageEl) roleMessageEl.textContent = "";

    /* =========================
       BATCH YEAR AUTO-FILL
       ========================= */
    if (batchSel) {
      batchSel.disabled = true;
      batchSel.setAttribute("aria-disabled", "true");
      batchSel.setAttribute("tabindex", "-1");
    }

    syncBatchYear(yearSel, levelSel, batchSel);

    if (yearSel) {
      yearSel.addEventListener("change", () => {
        syncBatchYear(yearSel, levelSel, batchSel);
      });
    }

    if (levelSel) {
      levelSel.addEventListener("change", () => {
        syncBatchYear(yearSel, levelSel, batchSel);
      });
    }

    /* =========================
       ADD CLASSES ACTION
       ========================= */
    if (addBtn) {
      addBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        const academicYear = String(yearSel?.value || "").trim();
        const level = String(levelSel?.value || "").trim();
        const batchYear = String(batchSel?.value || "").trim();

        if (!academicYear || !level || !batchYear) {
          logLine(logBox, "Please select Academic Year and Level.");
          return;
        }

        addBtn.disabled = true;
        addBtn.setAttribute("aria-disabled", "true");
        logBox.textContent = "";

        logLine(
          logBox,
          `Starting: AcademicYear=${academicYear}, Level=${level}, BatchYear=${batchYear}`
        );

        try {
          const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "addClassesToDatabase",
              academicYear: Number(academicYear),
              level: Number(level),
            }),
          });

          if (!res.ok) throw new Error(`Network error ${res.status}`);

          const json = await res.json();
          if (!json || !json.ok) throw new Error(json.error || "Backend error");

          if (Array.isArray(json.log)) {
            json.log.forEach((m) => logLine(logBox, String(m)));
          } else {
            logLine(logBox, "Completed.");
          }

          if (json.batchYear) {
            batchSel.value = String(json.batchYear);
          }

          if (json.summary) {
            logLine(logBox, `Summary: ${JSON.stringify(json.summary)}`);
          }

          logLine(logBox, "Done.");
        } catch (err) {
          console.error(err);
          logLine(logBox, `ERROR: ${err.message || String(err)}`);
        } finally {
          addBtn.disabled = false;
          addBtn.removeAttribute("aria-disabled");
        }
      });
    }
  });
})();