/* low-attend.js — kebab panel includes "Download CSV (All Years)" button
   - One button -> one CSV -> ALL years (7,8,9,10,12,13) stacked in one CSV file
   - Button is injected into the kebab panel so HTML does not need to be changed
*/

// ===== LOCK to signed in user only =====
(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // ===== ROLE GATE: kick out GENERAL, FT, WELFARE, HEP =====
  const role = String(who.role || "").toUpperCase().trim();
  const BLOCKED = ["GENERAL", "FT", "WELFARE", "HEP", ""];

  if (BLOCKED.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return; // stop everything else
  }

  // ===== CONFIG =====
  const WEBAPP_URL = "/.netlify/functions/low-attend";
  const DEFAULT_YEAR = "7";
  const YEARS_ALL = ["7", "8", "9", "10", "12", "13"]; // export ALL in one CSV

  // ===== DOM =====
  const $ = (s, root = document) => root.querySelector(s);
  const grid = $("#grid");
  const subhead = $("#subhead");
  const loadStatus = $("#loadStatus");
  const kebabBtn = $("#kebabBtn");
  const overlay = $("#overlay");
  const overlayDim = $("#overlayDim");
  const kebabClose = $("#kebabClose");

  // kebab panel container (nav list)
  const panelList = $(".panel-list"); // <nav class="panel-list">

  // Student card elements
  const card = $("#stuCard");
  const cardDim = $("#stuCardDim");
  const cardClose = $("#stuCardClose");
  const cardName = $("#stuName");
  const cardId = $("#stuId");
  const cardClass = $("#stuClass");

  // ===== Loading status (same pattern as Attendance Displays) =====
  function showStatus(text = "Loading. Please wait") {
    if (!loadStatus) return;
    loadStatus.innerHTML =
      `<span class="statusText"><strong>${text}</strong>` +
      `<span class="dots" aria-hidden="true"></span></span>`;
    loadStatus.style.display = ""; // show
  }

  function hideStatus() {
    if (!loadStatus) return;
    loadStatus.style.display = "none"; // hide
  }

  // ===== Data fetch & render (single year for on-screen view) =====
  async function fetchSheet(year) {
    showStatus("Loading. Please wait");

    let json;
    try {
      const url = new URL(WEBAPP_URL, location.origin);
      url.searchParams.set("s", year);

      const res = await fetch(url.toString(), { cache: "no-cache" });

      // Try JSON first
      try {
        json = await res.json();
      } catch {
        const text = await res.text();
        try {
          json = JSON.parse(text);
        } catch {
          const m = text && text.match(/\{[\s\S]*\}$/);
          json = m ? JSON.parse(m[0]) : null;
        }
      }

      if (!json || typeof json !== "object") {
        throw new Error("Bad response from server (not JSON). Check proxy/GAS.");
      }
      if (!json.ok) {
        throw new Error(json.error || "Server returned an error.");
      }
    } catch (err) {
      hideStatus();
      alert(err.message || String(err));
      return;
    }

    try {
      renderTable(json);
    } catch (err) {
      hideStatus();
      alert("Render error: " + (err.message || String(err)));
      return;
    }

    hideStatus();
  }

  // Escape HTML
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // Parse header rows to find Name / ID / Class columns (case-insensitive).
  function findHeaderMap(headRows) {
    const cols = Math.max(...headRows.map((r) => r.length));
    const labels = Array(cols).fill("");
    for (let r = 0; r < headRows.length; r++) {
      for (let c = 0; c < (headRows[r]?.length || 0); c++) {
        const val = (headRows[r][c] ?? "").toString().trim();
        if (val) labels[c] = val;
      }
    }
    const lower = labels.map((t) => t.toLowerCase());
    const idxBy = (preds) => {
      for (let i = 0; i < lower.length; i++) {
        const t = lower[i];
        if (!t) continue;
        if (preds.some((p) => p(t))) return i;
      }
      return -1;
    };

    const nameIdx = idxBy([
      (t) => /\bname\b/.test(t),
      (t) => /\bstudent.*name\b/.test(t),
    ]);
    const idIdx = idxBy([
      (t) => /\bid\b/.test(t),
      (t) => /\bstudent.*id\b/.test(t),
      (t) => /\bindex\b/.test(t),
    ]);
    const classIdx = idxBy([
      (t) => /\bclass\b/.test(t),
      (t) => /\bform\b/.test(t),
      (t) => /\bsection\b/.test(t),
    ]);

    const fallbackName = nameIdx >= 0 ? nameIdx : 1;
    const fallbackId = idIdx >= 0 ? idIdx : 2;
    const fallbackCls = classIdx >= 0 ? classIdx : 3;

    return { nameCol: fallbackName, idCol: fallbackId, classCol: fallbackCls };
  }

  function renderTable(payload) {
    const { data, headerRows = 2 } = payload;

    if (!Array.isArray(data) || data.length === 0) {
      grid.innerHTML =
        "<thead><tr><th>No data</th></tr></thead><tbody></tbody>";
      return;
    }

    const safeHeaderRows = Math.max(0, Math.min(headerRows, data.length));
    const head = data.slice(0, safeHeaderRows);
    const body = data.slice(safeHeaderRows);

    // Build header
    let thead = "<thead>";
    head.forEach((row) => {
      thead += "<tr>";
      row.forEach((cell) => {
        thead += `<th>${esc(cell)}</th>`;
      });
      thead += "</tr>";
    });
    thead += "</thead>";

    // Build body
    let tbody = "<tbody>";
    body.forEach((row, rIdx) => {
      tbody += `<tr data-r="${rIdx}">`;
      row.forEach((cell, cIdx) => {
        const val = esc(cell);
        const hasVal = String(cell ?? "").trim().length > 0;
        tbody += `<td data-c="${cIdx}" data-has="${
          hasVal ? "1" : "0"
        }">${val}</td>`;
      });
      tbody += "</tr>";
    });
    tbody += "</tbody>";

    grid.innerHTML = thead + tbody;

    const headerMap = findHeaderMap(head);
    bindRowClicks(grid, body, headerMap);
  }

  function bindRowClicks(table, rows, headerMap) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    tbody.addEventListener("click", (e) => {
      const cell = e.target.closest("td");
      if (!cell) return;
      if (cell.getAttribute("data-has") !== "1") return;

      const tr = cell.parentElement;
      const r = parseInt(tr.getAttribute("data-r"), 10);
      if (isNaN(r) || !rows[r]) return;

      const name = safeCell(rows[r], headerMap.nameCol);
      const id = safeCell(rows[r], headerMap.idCol);
      const cls = safeCell(rows[r], headerMap.classCol);
      if (!name && !id && !cls) return;

      openStudentCard({ name, id, cls });
    });
  }

  function safeCell(row, idx) {
    if (!row || typeof idx !== "number" || idx < 0 || idx >= row.length)
      return "";
    return String(row[idx] ?? "").trim();
  }

  // ===== Student Card (modal) =====
  function openStudentCard({ name, id, cls }) {
    if (!card) return;
    if (cardName) cardName.textContent = name || "—";
    if (cardId) cardId.textContent = id || "—";
    if (cardClass) cardClass.textContent = cls || "—";
    card.hidden = false;
    setTimeout(() => cardClose?.focus(), 0);
  }
  function closeStudentCard() {
    if (card) card.hidden = true;
  }

  cardClose?.addEventListener("click", closeStudentCard);
  cardDim?.addEventListener("click", closeStudentCard);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && card && !card.hidden) closeStudentCard();
  });

  // ===== Kebab overlay (left vertical) =====
  kebabBtn?.addEventListener("click", () => {
    if (overlay) overlay.hidden = false;
  });
  overlayDim?.addEventListener("click", () => {
    if (overlay) overlay.hidden = true;
  });
  kebabClose?.addEventListener("click", () => {
    if (overlay) overlay.hidden = true;
  });

  overlay?.addEventListener("click", (e) => {
    const btn = e.target.closest(".panel-item");
    if (!btn) return;

    // If it's our export button, handle separately
    if (btn.getAttribute("data-action") === "export-csv") return;

    const year =
      btn.getAttribute("data-year") ||
      (btn.textContent && btn.textContent.replace(/\D/g, ""));
    if (!year) return;

    overlay.hidden = true;
    if (subhead) subhead.textContent = `Year ${year}`;
    fetchSheet(year);
  });

  // ===== CSV: ONE button -> ONE file -> ALL tables stacked =====
  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function rowsToCSV(rows) {
    return rows.map((r) => (r || []).map(csvEscape).join(",")).join("\r\n");
  }

  function downloadCSV(csvText, filename) {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    a.remove();
    URL.revokeObjectURL(url);
  }

  async function fetchTableForYear(year) {
    const url = new URL(WEBAPP_URL, location.origin);
    url.searchParams.set("s", String(year));

    const res = await fetch(url.toString(), { cache: "no-cache" });

    let json;
    try {
      json = await res.json();
    } catch {
      const text = await res.text();
      try {
        json = JSON.parse(text);
      } catch {
        const m = text && text.match(/\{[\s\S]*\}$/);
        json = m ? JSON.parse(m[0]) : null;
      }
    }

    if (!json || typeof json !== "object") {
      throw new Error(`Bad response for Year ${year} (not JSON).`);
    }
    if (!json.ok) {
      throw new Error(json.error || `Server error for Year ${year}.`);
    }
    if (!Array.isArray(json.data)) {
      throw new Error(`Missing table data for Year ${year}.`);
    }

    return json.data; // includes header rows
  }

  async function exportAllYearsToOneCSV(btnEl) {
    if (btnEl) btnEl.disabled = true;
    showStatus("Preparing CSV");

    try {
      const parts = [];

      // sequential fetch (safer / lighter)
      for (const y of YEARS_ALL) {
        const data = await fetchTableForYear(y);

        // Section header row (acts like a "sheet name" marker inside CSV)
        parts.push(rowsToCSV([[`=== Year ${y} (sheet ${y}) ===`]]));

        // Table content
        parts.push(rowsToCSV(data));

        // Spacer
        parts.push("\r\n");
      }

      const finalCSV = parts.join("\r\n");
      downloadCSV(finalCSV, "low-attend-all-years.csv");
    } finally {
      hideStatus();
      if (btnEl) btnEl.disabled = false;
      // keep panel open (optional). comment next line to keep open.
      if (overlay) overlay.hidden = true;
    }
  }

  // ===== Inject "Download CSV" button into kebab panel =====
  function injectExportButton() {
    if (!panelList) return;
    if (panelList.querySelector('[data-action="export-csv"]')) return; // already injected

    const btn = document.createElement("button");
    btn.className = "panel-item";
    btn.type = "button";
    btn.setAttribute("data-action", "export-csv");
    btn.textContent = "Download CSV";

    // Put it at the top of the panel
    panelList.appendChild(btn);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      exportAllYearsToOneCSV(btn).catch((err) => {
        alert(err.message || String(err));
      });
    });
  }

  injectExportButton();

  // ===== First load =====
  if (subhead) subhead.textContent = `Year ${DEFAULT_YEAR}`;
  fetchSheet(DEFAULT_YEAR);
})();
