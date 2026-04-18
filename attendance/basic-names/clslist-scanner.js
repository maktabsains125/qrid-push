(() => {
  "use strict";

  // ===== ROLE GATE (REGIS + CODER only) =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) { window.location.replace("/"); return; }

  const role = String(who.role || "").toUpperCase().trim();
  const ALLOW = ["REGIS", "CODER"];
  if (!ALLOW.includes(role)) {
    // disable quietly (no click)
    const btn = document.getElementById("btnClslistScanner");
    if (btn) btn.disabled = true;
    return;
  }

  // ===== CONFIG =====
  // GAS Web App URL 
  const WEBAPP_URL = "/.netlify/functions/clslist-scanner";

  const $ = (id) => document.getElementById(id);
  const els = {
    log: $("logBoxScanner"),
    btn: $("btnClslistScanner"),
  };

  function line(txt) {
    els.log.textContent += (els.log.textContent ? "\n" : "") + txt;
  }

  function setLog(txt) {
    els.log.textContent = txt || "";
  }

  function tickLine(label, on) {
    // Static checkbox style (no animations)
    return `${on ? "☑" : "☐"} ${label}`;
  }

  function renderLevels(levels) {
    setLog("");
    line(tickLine("Level 7",  !!levels["7"]));
    line(tickLine("Level 8",  !!levels["8"]));
    line(tickLine("Level 9",  !!levels["9"]));
    line(tickLine("Level 10", !!levels["10"]));
    line(tickLine("Level 12", !!levels["12"]));
    line(tickLine("Level 13", !!levels["13"]));
  }

  async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
    return data;
  }

  async function loadStatus() {
    try {
      const data = await fetchJSON(`${WEBAPP_URL}?action=status`, { method: "GET" });
      if (!data.ok) throw new Error(data.error || "Status failed");

      renderLevels(data.levels);

      if (!data.canRun) {
        line("");
        line("⚠ Complete steps 1 to 3 first for each level.");
      }
    } catch (err) {
      setLog(`Error loading status: ${String(err.message || err)}`);
    }
  }

  async function runUpdate() {
  els.btn.disabled = true;
  line("");
  line("Running update…");

  try {
    // 1) INFO
    line("");
    line("• INFO…");
    let data = await fetchJSON(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "runInfo" }),
    });
    if (!data.ok) throw new Error(data.error || "INFO failed");
    if (Array.isArray(data.log)) data.log.forEach(x => line(`  - ${x.msg || x}`));

    // 2) Each tab
    const tabs = ["7","8","9","10","12","13"];
    for (const tab of tabs) {
      line("");
      line(`• Tab ${tab}…`);
      data = await fetchJSON(WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "runOne", tab }),
      });
      if (!data.ok) throw new Error(`${tab}: ${data.error || "failed"}`);
      if (Array.isArray(data.log)) data.log.forEach(x => line(`  - ${x.msg || x}`));
    }

    line("");
    line("✅ All done");
  } catch (err) {
    line(`❌ Error: ${String(err.message || err)}`);
  } finally {
    els.btn.disabled = false;
  }
}


  // ===== INIT =====
  if (els.btn) els.btn.addEventListener("click", runUpdate);
  loadStatus();
})();
