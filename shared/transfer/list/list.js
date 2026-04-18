/* list.js — TRANSFERRED LIST */

(function () {
  "use strict";

  // ===== Role gate =====
  const ALLOW = new Set(["ADMIN", "CODER", "REGIS", "WELFARE"]);

  (async function gate() {
    const who = (window.Auth && Auth.waitWho) ? await Auth.waitWho() : (window.Auth && Auth.who && Auth.who());
    if (!who) { location.href = "/"; return; }

    const role = String(who.role || "").toUpperCase().trim();
    if (!ALLOW.has(role)) {
      location.href = (window.Auth && Auth.routeFor) ? Auth.routeFor(role) : "/roles/general";
      return;
    }
  })();

  // ===== DOM =====
  const kebabBtn   = document.getElementById("kebabBtn");
  const overlay    = document.getElementById("overlay");
  const overlayDim = document.getElementById("overlayDim");
  const panelClose = document.getElementById("panelClose");
  const goAttendance = document.getElementById("goAttendance");

  const typeSel = document.getElementById("typeSel");
  const levelSel = document.getElementById("levelSel");

  const listBtn = document.getElementById("listBtn");
  const dlBtn   = document.getElementById("dlBtn");

  const statusText = document.getElementById("statusText");
  const dotsBox = document.getElementById("dotsBox");

  const tableWrap = document.getElementById("tableWrap");

  // ===== State =====
  let lastRows = [];
  let tableRendered = false;

  // ===== Dots animation (QRID standard) =====
  let dotsTimer = null;
  function startDots() {
    stopDots();
    const frames = ["", ".", "..", "..."];
    let i = 0;
    dotsTimer = setInterval(() => {
      dotsBox.textContent = frames[i % frames.length];
      i++;
    }, 450);
  }
  function stopDots() {
    if (dotsTimer) clearInterval(dotsTimer);
    dotsTimer = null;
    dotsBox.textContent = "";
  }

  function setStatus(msg, loading) {
    statusText.textContent = msg || "";
    if (loading) startDots(); else stopDots();
  }

  function normalizeTypeForUi(t) {
    const s = String(t || "");
    return s === "Out" || s === "Into" || s === "Class" ? s : "Out";
  }

function updateDownloadVisibility() {
  const t = normalizeTypeForUi(typeSel.value);
  const show = (t === "Out");

  if (show) dlBtn.classList.remove("isHidden");
  else dlBtn.classList.add("isHidden");
}


  function clearTable() {
    tableWrap.innerHTML = "";
    lastRows = [];
    tableRendered = false;
    updateDownloadVisibility();
  }

  function esc(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderTable(rows) {
    const thead = `
      <thead>
        <tr>
          <th>NAME</th>
          <th>GENDER</th>
          <th>ID</th>
          <th>FROM</th>
          <th>INTO</th>
          <th>TRANSFER DATE</th>
        </tr>
      </thead>
    `;

    const tbody = (rows || []).map(r => `
      <tr>
        <td class="leftCol">${esc(r.name || "")}</td>
        <td>${esc(r.gender || "")}</td>
        <td>${esc(r.id || "")}</td>
        <td>${esc(r.from || "")}</td>
        <td>${esc(r.into || "")}</td>
        <td>${esc(r.date || "")}</td>
      </tr>
    `).join("");

    tableWrap.innerHTML = `
      <table class="grid" aria-label="Transferred list table">
        ${thead}
        <tbody>${tbody}</tbody>
      </table>
    `;
  }

  async function fetchList() {
    const type = normalizeTypeForUi(typeSel.value);
    const level = String(levelSel.value || "").trim();

    setStatus("Loading. Please wait", true);
    listBtn.disabled = true;

    try {
      const url = `/.netlify/functions/transfer-list?type=${encodeURIComponent(type)}&level=${encodeURIComponent(level)}`;
      const r = await fetch(url, { method: "GET" });
      const data = await r.json();

      if (!data || !data.ok) throw new Error((data && data.error) || "Failed");

      lastRows = Array.isArray(data.rows) ? data.rows : [];
      renderTable(lastRows);

      tableRendered = true;
      setStatus(`Loaded (${lastRows.length})`, false);
    } catch (err) {
      tableRendered = false;
      tableWrap.innerHTML = `<div class="gridError">Failed to load list.<br>${esc(err && err.message ? err.message : err)}</div>`;
      setStatus("Failed", false);
    } finally {
      listBtn.disabled = false;
      updateDownloadVisibility();
    }
  }

  function downloadXlsx() {
    const type = normalizeTypeForUi(typeSel.value);
    const level = String(levelSel.value || "").trim();

    // Only enabled after list render; download only visible for Out
    const url = `/.netlify/functions/transfer-list?type=${encodeURIComponent(type)}&level=${encodeURIComponent(level)}&download=1`;
    window.location.href = url;
  }

  // ===== Events =====
  typeSel.addEventListener("change", () => {
    clearTable();
    updateDownloadVisibility();
    setStatus("Ready", false);
  });

  levelSel.addEventListener("change", () => {
    clearTable();
    setStatus("Ready", false);
  });

  listBtn.addEventListener("click", fetchList);

  // ===== Kebab overlay =====
  function openMenu() { overlay.hidden = false; }
  function closeMenu() { overlay.hidden = true; }

  kebabBtn.addEventListener("click", openMenu);
  overlayDim.addEventListener("click", closeMenu);
  panelClose.addEventListener("click", closeMenu);

  goAttendance.addEventListener("click", () => {
    location.href = "/shared/transfer/attendance/out-lvl.html";
  });

  // ===== Init =====
  setStatus("Ready", false);
  updateDownloadVisibility();
})();
