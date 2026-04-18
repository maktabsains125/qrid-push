(() => {
  "use strict";

  // ===== ROLE GATE (REGIS + CODER only) =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  const role = String(who.role || "").toUpperCase().trim();
  const ALLOW = ["REGIS", "CODER"];
  if (!ALLOW.includes(role)) {
    const dest =
      window.Auth && typeof Auth.routeFor === "function"
        ? Auth.routeFor(role) || "/"
        : "/";
    window.location.replace(dest);
    return;
  }

  // ===== URLs =====
  const CLOSE_URL = "/shared/attendance/reports/reports.html";
  const FN_URL = "/.netlify/functions/basic-names";

  // ✅ corrected to your required path
  const CLS_URL = "/shared/profile/class-info/class.html";

  const SS_URL =
    "https://docs.google.com/spreadsheets/d/1OYI7xsbUGEccwh6q8mGXB6ualBXqjgiB7-dS0vhahF0/edit?usp=sharing";

  // ===== UI refs =====
  const btnClose = document.getElementById("btnClose");
  const levelSel = document.getElementById("levelSel");

  const btnCls = document.getElementById("btnCls");
  const btnSS = document.getElementById("btnSS");

  const btnRun = document.getElementById("btnRun");
  const logBox = document.getElementById("logBox");

  /* =================================================
     ✅ INIT LEFT KEBAB
     ================================================= */
  if (window.LeftKebab && typeof LeftKebab.init === "function") {
    LeftKebab.init();
  }

  // ===== Log helper =====
  function setLog(msg) {
    if (!logBox) return;
    if (Array.isArray(msg)) logBox.textContent = msg.join("\n");
    else logBox.textContent = String(msg || "");
  }

  // ===== Header X → back to reports =====
  if (btnClose) {
    btnClose.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.location.href = CLOSE_URL;
    });
  }

  // ===== btnCls → class.html (REGIS/CODER only already gated) =====
  if (btnCls) {
    btnCls.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.location.href = CLS_URL;
    });
  }

  // ===== btnSS → Google Sheet (new tab) =====
  if (btnSS) {
    btnSS.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.open(SS_URL, "_blank", "noopener,noreferrer");
    });
  }

  // ===== Runner (✅ now truly runs ONE selected level) =====
  async function run() {
    const level = String(levelSel && levelSel.value ? levelSel.value : "").trim();
    if (!level) {
      setLog(["Please select a level."]);
      return;
    }

    if (btnRun) btnRun.disabled = true;
    setLog("Running...");

    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ align with GAS: addBasicNamesOne runs ONE tab
        body: JSON.stringify({ action: "addBasicNamesOne", level }),
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, log: ["Non-JSON response from server:", text] };
      }

      if (data && data.log) setLog(data.log);
      else setLog(JSON.stringify(data, null, 2));
    } catch (err) {
      setLog(["ERROR: " + (err?.message || String(err))]);
    } finally {
      if (btnRun) btnRun.disabled = false;
    }
  }

  // ===== Button =====
  if (btnRun) btnRun.addEventListener("click", run);

  // ===== Initial text =====
  setLog(["Ready.", "Select Level, then click “Add basic names”."]);
})();
