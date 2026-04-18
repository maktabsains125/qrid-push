/* trans-into.js (UPDATED)
   Changes:
   - ✅ NO progress bar (all related code removed)
   - ✅ Never show "Error: ..." if backend steps 1–5 are completed (or skipped)
   - ✅ UI tick issues never count as an error
   - ✅ goBtn disabled daily 5:00am–3:00pm Brunei time EXCEPT Friday & Sunday
*/

(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // ===== ROLE ALLOW-LIST: only CODER and REGIS =====
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED_ROLES = ["CODER", "REGIS"];

  if (!ALLOWED_ROLES.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return;
  }

  // ====== CONFIG ======
  const API_URL = "/.netlify/functions/trans-into";
  const BRUNEI_TZ = "Asia/Brunei"; // Brunei timezone

  // ====== DOM LOOKUPS ======
  const stuName   = document.getElementById("stuName");
  const stuId     = document.getElementById("stuId");
  const fromClass = document.getElementById("fromClass");
  const levelSel  = document.getElementById("levelSelect");
  const classSel  = document.getElementById("classSelect");
  const dateIn    = document.getElementById("dateIn");

  const goBtn     = document.getElementById("goBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  const finalMsg  = document.getElementById("finalMsg");

  // step list items
  const s1 = document.getElementById("s1");
  const s2 = document.getElementById("s2");
  const s3 = document.getElementById("s3");
  const s4 = document.getElementById("s4");
  const s5 = document.getElementById("s5");

  // kebab / overlay DOM
  const kebabBtn      = document.getElementById("kebabBtn");
  const kebabPanel    = document.getElementById("kebabPanel");
  const kebabDim      = document.getElementById("kebabDim");
  const panelCloseBtn = document.getElementById("panelCloseBtn");

  const navInto  = document.getElementById("navInto");
  const navOut   = document.getElementById("navOut");
  const navClass = document.getElementById("navClass");

  // ===== Helpers =====

  function openMenu() {
    if (!kebabPanel) return;
    kebabPanel.hidden = false;
    kebabPanel.setAttribute("aria-hidden", "false");
  }
  function closeMenu() {
    if (!kebabPanel) return;
    kebabPanel.hidden = true;
    kebabPanel.setAttribute("aria-hidden", "true");
  }

  function goTo(path) {
    location.href = path;
  }

  function tick(liElem) {
    if (!liElem) return;
    const tickSpan = liElem.querySelector(".tick");
    if (tickSpan) tickSpan.textContent = "✓";
  }

  function resetStepsUI() {
    [s1, s2, s3, s4, s5].forEach((li) => {
      if (!li) return;
      const t = li.querySelector(".tick");
      if (t) t.textContent = "";
    });
  }

  function lockForm(disabled) {
    [
      stuName,
      stuId,
      fromClass,
      levelSel,
      classSel,
      dateIn,
      goBtn,
      cancelBtn
    ].forEach((el) => {
      if (el) el.disabled = disabled;
    });

    document.querySelectorAll('input[name="gender"]').forEach((r) => {
      r.disabled = disabled;
    });
  }

  function getGender() {
    const r = document.querySelector('input[name="gender"]:checked');
    return r ? r.value : "";
  }

  function validId(idStr) {
    return /^[0-9]{5}$/.test(idStr);
  }

  function clearForm() {
    if (stuName) stuName.value = "";
    if (stuId) stuId.value = "";
    if (fromClass) fromClass.value = "";
    if (levelSel) levelSel.value = "";
    if (classSel) {
      classSel.innerHTML = `<option value="">Class</option>`;
      classSel.disabled = true;
    }
    if (dateIn) dateIn.value = "";

    document.querySelectorAll('input[name="gender"]').forEach((r) => {
      r.checked = false;
    });

    resetStepsUI();
    if (finalMsg) finalMsg.textContent = "";
  }

  // ---- Safe date/time gate: disable GO 5:00–15:00 Brunei time except Fri & Sun ----
  function getBruneiParts_() {
    // Uses Intl to interpret "now" in Asia/Brunei without relying on device TZ.
    const dtf = new Intl.DateTimeFormat("en-GB", {
      timeZone: BRUNEI_TZ,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = dtf.formatToParts(new Date());
    const map = {};
    parts.forEach((p) => (map[p.type] = p.value));
    return {
      weekday: String(map.weekday || ""),  // "Mon","Tue","Wed","Thu","Fri","Sat","Sun"
      hour: parseInt(map.hour || "0", 10),
      minute: parseInt(map.minute || "0", 10)
    };
  }

  function isGoBlockedNow_() {
    const p = getBruneiParts_();
    const wd = p.weekday; // "Fri" / "Sun" etc

    // Exceptions: Fri and Sun => never blocked by this time rule
    if (wd === "Fri" || wd === "Sun") return false;

    const mins = (p.hour * 60) + p.minute;
    const start = 5 * 60;   // 05:00
    const end = 15 * 60;    // 15:00

    // Block from 05:00 inclusive until 15:00 exclusive
    return (mins >= start && mins < end);
  }

  function applyGoTimeGate_() {
    if (!goBtn) return;

    // If form is locked (processing), keep disabled regardless of time gate.
    // Otherwise apply gate rule.
    const isProcessingLocked = !!goBtn.disabled && !!window.__TRANS_INTO_LOCKED__;
    if (isProcessingLocked) return;

    const blocked = isGoBlockedNow_();
    goBtn.disabled = blocked;

    if (finalMsg) {
      if (blocked) {
        finalMsg.textContent = "Transfers are disabled from 5:00am to 3:00pm (Brunei time), except Fri & Sun.";
      } else {
        // Only clear this specific gate message (avoid wiping other messages)
        const gateMsg = "Transfers are disabled from 5:00am to 3:00pm (Brunei time), except Fri & Sun.";
        if (finalMsg.textContent === gateMsg) finalMsg.textContent = "";
      }
    }
  }

  // Apply immediately and then re-check periodically (no visual animation)
  applyGoTimeGate_();
  setInterval(applyGoTimeGate_, 30 * 1000);

  // ===== Determine completion from steps (done OR skipped) =====
  function isDoneOrSkipped_(stepsObj, stepKey) {
    if (!stepsObj) return false;
    if (stepsObj[stepKey]) return true;
    if (Array.isArray(stepsObj.skipped) && stepsObj.skipped.indexOf(stepKey) !== -1) return true;
    return false;
  }

  function allFiveDoneOrSkipped_(stepsObj) {
    return (
      isDoneOrSkipped_(stepsObj, "step1") &&
      isDoneOrSkipped_(stepsObj, "step2") &&
      isDoneOrSkipped_(stepsObj, "step3") &&
      isDoneOrSkipped_(stepsObj, "step4") &&
      isDoneOrSkipped_(stepsObj, "step5")
    );
  }

  // ===== Update ticks ONLY (never treat tick/UI failures as fatal) =====
  function updateTicksSafe_(stepsObj) {
    try {
      if (isDoneOrSkipped_(stepsObj, "step1")) tick(s1);
      if (isDoneOrSkipped_(stepsObj, "step2")) tick(s2);
      if (isDoneOrSkipped_(stepsObj, "step3")) tick(s3);
      if (isDoneOrSkipped_(stepsObj, "step4")) tick(s4);
      if (isDoneOrSkipped_(stepsObj, "step5")) tick(s5);
    } catch (e) {
      // Intentionally ignore UI tick issues
    }
  }

  // ===== Fetch classes by level =====
  async function fetchClasses(levelVal) {
    if (!classSel) return;

    if (!levelVal) {
      classSel.disabled = true;
      classSel.innerHTML = `<option value="">Class</option>`;
      return;
    }

    classSel.disabled = true;
    classSel.innerHTML = `<option value="">Loading…</option>`;

    const url = `${API_URL}?mode=getClasses&level=${encodeURIComponent(levelVal)}`;

    let data;
    try {
      const r = await fetch(url, { method: "GET" });
      data = await r.json();
    } catch (e) {
      data = { ok: false, error: "Bad JSON" };
    }

    if (!data.ok || !data.classes) {
      classSel.innerHTML = `<option value="">(error)</option>`;
      return;
    }

    classSel.innerHTML =
      `<option value="">Class</option>` +
      data.classes
        .map((cls) => `<option value="${cls}">${cls}</option>`)
        .join("");

    classSel.disabled = false;
  }

  if (levelSel) {
    levelSel.addEventListener("change", () => {
      fetchClasses(levelSel.value);
    });
  }

  // ===== Cancel button =====
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      clearForm();
      applyGoTimeGate_();
    });
  }

  // ===== Submit / Transfer button =====
  if (goBtn) {
    goBtn.addEventListener("click", async () => {
      if (finalMsg) finalMsg.textContent = "";
      resetStepsUI();

      // Time gate check (in case interval hasn't run yet)
      if (isGoBlockedNow_()) {
        applyGoTimeGate_();
        return;
      }

      // validate
      const nameVal = (stuName && stuName.value ? stuName.value : "").trim();
      const genderVal = getGender();
      const idVal = (stuId && stuId.value ? stuId.value : "").trim();
      const fromVal = (fromClass && fromClass.value ? fromClass.value : "").trim();
      const levelVal = levelSel ? levelSel.value : "";
      const classVal = classSel ? classSel.value : "";
      const dateVal = dateIn ? dateIn.value : "";

      if (!nameVal || !genderVal || !idVal || !fromVal || !levelVal || !classVal || !dateVal) {
        if (finalMsg) finalMsg.textContent = "Please fill all fields.";
        return;
      }
      if (!validId(idVal)) {
        if (finalMsg) finalMsg.textContent = "ID must be exactly 5 digits.";
        return;
      }

      // lock UI while processing
      window.__TRANS_INTO_LOCKED__ = true;
      lockForm(true);

      const payload = {
        name: nameVal,
        gender: genderVal,
        id: idVal,
        fromClass: fromVal,
        level: levelVal,
        toClass: classVal,
        transferDate: dateVal
      };

      let respJSON = null;
      let httpOk = true;

      try {
        const r = await fetch(API_URL + "?mode=transferStudent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        httpOk = !!r.ok;

        try {
          respJSON = await r.json();
        } catch (errJson) {
          respJSON = { ok: false, error: "Invalid JSON from server" };
        }

        if (!httpOk) {
          // Keep status text internally; UI rules decide what to show.
          const extra = r.statusText ? ` (${r.statusText})` : "";
          respJSON.ok = false;
          respJSON.error = respJSON.error || `HTTP ${r.status}${extra}`;
        }
      } catch (err) {
        respJSON = { ok: false, error: String(err) };
      }

      const stepsObj = (respJSON && respJSON.steps) ? respJSON.steps : null;

      // Update ticks (safe, non-fatal)
      updateTicksSafe_(stepsObj);

      // ---- Message rules ----
      // Never show "Error: ..." if steps 1–5 are done/skipped.
      if (allFiveDoneOrSkipped_(stepsObj)) {
        if (finalMsg) finalMsg.textContent = "Transfer complete.";
      } else {
        // Not fully completed: show a simple message.
        // (Allowed to show error here because backend steps not confirmed complete.)
        const msg = (respJSON && respJSON.error) ? String(respJSON.error) : "Unknown";
        if (finalMsg) finalMsg.textContent = "Transfer not completed. " + msg;
      }

      // unlock UI again
      window.__TRANS_INTO_LOCKED__ = false;
      lockForm(false);

      // re-apply time gate after unlocking
      applyGoTimeGate_();
    });
  }

  // ===== Kebab menu wiring =====
  if (kebabBtn) kebabBtn.addEventListener("click", openMenu);
  if (panelCloseBtn) panelCloseBtn.addEventListener("click", closeMenu);
  if (kebabDim) kebabDim.addEventListener("click", closeMenu);

  if (navInto) navInto.addEventListener("click", () => goTo("/shared/transfer/transpr/trans-into/trans-into.html"));
  if (navOut)  navOut.addEventListener("click",  () => goTo("/shared/transfer/transpr/trans-out/trans-out.html"));
  if (navClass)navClass.addEventListener("click",() => goTo("/shared/transfer/transpr/trans-class/trans-class.html"));

})();
