/* out-lvl.js
   - Require login via Auth (CODER / REGIS / WELFARE / ADMIN only)
   - Fetch TRANS OUT entries for selected level
   - Render into grey card table
   - Row click => custom popup with details
   - "Download csv" => CSV built on the client from currentRows
       • Header row: Level, To, From, Name, Gender, Id
       • Filename: YYYY - Year <level> - Trans out.csv
   - Uses standard QRID loading status (.… → .. → . → blank)
*/

(function () {
  "use strict";

  // ===== LOCK to signed-in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // ===== ROLE CHECK =====
  const allowedRoles = ["CODER", "REGIS", "WELFARE", "ADMIN"];
  const role = (who.role || "").toUpperCase();
  if (!allowedRoles.includes(role)) {
    // Silently redirect to their own dashboard
    const redirect = Auth.routeFor(role);
    window.location.replace(redirect);
    return;
  }

  // ===== CONFIG =====
  const API_URL = "/.netlify/functions/out-lvl";
  const DEFAULT_LEVEL = "7";

  // ===== DOM helpers =====
  const $ = (sel, root = document) => root.querySelector(sel);

  const grid        = $("#grid");
  const subhead     = $("#subhead");

  const kebabPanel  = $("#kebabPanel");
  const kebabDim    = $("#kebabDim");
  const kebabBtn    = $("#kebabBtn");
  const panelClose  = $("#panelCloseBtn");
  const levelBtns   = document.querySelectorAll(".levelBtn");
  const gridError   = $("#gridError");

  // Standard QRID loading status elements
  const loadStatus  = $("#loadStatus");
  const loadMsg     = $("#loadMsg");
  const dotsEl      = $("#dots");

  const downloadBtn = $("#downloadBtn");

  // Popup elements
  const popup       = $("#popup");
  const popupBody   = $("#popupBody");
  const popupClose  = $("#popupClose");

  // Attendance button (kebab menu)
  const attendBtn   = $(".attendBtn");

  let dotsTimer     = null;
  let currentLevel  = DEFAULT_LEVEL;
  let currentRows   = []; // keep rows for popup + CSV

  // ===== Standard QRID loading dots (.… → .. → . → blank) =====
  function startDots() {
    stopDots();
    if (!dotsEl) return;

    const frames = [".", "..", "..."];
    let i = 0;
    dotsEl.textContent = frames[0];

    dotsTimer = setInterval(() => {
      i = (i + 1) % frames.length;
      dotsEl.textContent = frames[i];
    }, 700); // slower + safer
  }

  function stopDots() {
    if (dotsTimer) {
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
  }

  function showStatus(message) {
    if (!loadStatus) return;
    loadStatus.hidden = false;
    if (loadMsg) loadMsg.textContent = message;
    startDots();
  }

  function hideStatus() {
    stopDots();
    if (!loadStatus) return;
    loadStatus.hidden = true;
  }

  // ===== Render table =====
  function renderTable(rows) {
    if (!grid) return;

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

    let tbody = "<tbody>";
    rows.forEach((r, idx) => {
      tbody += `
        <tr data-index="${idx}">
          <td>${r.name   ?? ""}</td>
          <td>${r.gender ?? ""}</td>
          <td>${r.id     ?? ""}</td>
          <td>${r.from   ?? ""}</td>
          <td>${r.into   ?? ""}</td>
          <td>${r.date   ?? ""}</td>
        </tr>
      `;
    });
    tbody += "</tbody>";

    grid.innerHTML = thead + tbody;
  }

  // ===== Safe-ish JSON parser for backend responses =====
  function safeParseJson(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      // Try to salvage last JSON object if there is noise before it
      const m = text.match(/\{[\s\S]*\}$/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  }

  // ===== Normalize server data into an array of row objects =====
  function normalizeRows(data) {
    if (!data) return [];

    // Preferred: { rows: [...] }
    if (Array.isArray(data.rows)) {
      return data.rows;
    }

    // If data itself is an array
    if (Array.isArray(data)) {
      return data;
    }

    // If rows is an object (e.g. keyed)
    if (data.rows && typeof data.rows === "object") {
      return Object.values(data.rows);
    }

    // Fallback: no recognizable structure
    return [];
  }

  // ===== Fetch & load data for a level =====
  async function loadLevel(level) {
    currentLevel = String(level);

    if (subhead) subhead.textContent = `Year ${currentLevel}`;

    showStatus(`Loading Year ${currentLevel}. Please wait`);

    if (grid) grid.innerHTML = "";
    if (gridError) {
      gridError.hidden = true;
      gridError.textContent = "";
    }

    try {
      const params = new URLSearchParams({
        action: "list",
        level: currentLevel,
      });

      const res = await fetch(`${API_URL}?${params.toString()}`, {
        cache: "no-cache",
      });

      const text = await res.text();
      console.log("[out-lvl] RAW RESPONSE:", text);

      const data = safeParseJson(text);
      const rows = normalizeRows(data);

      if (!rows.length) {
        console.warn("[out-lvl] No rows found in server response.");
      }

      currentRows = rows;
      renderTable(currentRows);

    } catch (err) {
      console.error(err);
      if (gridError) {
        gridError.hidden = false;
        gridError.textContent = "Failed to load data";
      }
      if (grid) {
        grid.innerHTML = `
          <thead>
            <tr><th>Error</th></tr>
          </thead>
          <tbody>
            <tr><td>${(err && err.message) || String(err)}</td></tr>
          </tbody>
        `;
      }
    } finally {
      hideStatus();
    }
  }

  // ===== Custom popup =====
  function showPopup(row) {
    if (!popup || !popupBody) return;

    popupBody.innerHTML = `
      <p><strong>Name:</strong> ${row.name || ""}</p>
      <p><strong>Gender:</strong> ${row.gender || ""}</p>
      <p><strong>ID:</strong> ${row.id || ""}</p>
      <p><strong>From:</strong> ${row.from || ""}</p>
      <p><strong>Into:</strong> ${row.into || ""}</p>
      <p><strong>Transfer Date:</strong> ${row.date || ""}</p>
    `;

    popup.hidden = false;
  }

  function closePopup() {
    if (popup) popup.hidden = true;
  }

  popupClose?.addEventListener("click", closePopup);
  popup?.addEventListener("click", (e) => {
    if (e.target === popup) closePopup();
  });

  if (grid) {
    grid.addEventListener("click", (evt) => {
      const tr = evt.target.closest("tbody tr[data-index]");
      if (!tr) return;
      const idx = Number(tr.dataset.index);
      const row = currentRows[idx];
      if (row) showPopup(row);
    });
  }

  // ===== Kebab menu =====
  kebabBtn?.addEventListener("click", () => {
    if (!kebabPanel) return;
    kebabPanel.hidden = false;
    kebabPanel.setAttribute("aria-hidden", "false");
  });

  panelClose?.addEventListener("click", () => {
    if (!kebabPanel) return;
    kebabPanel.hidden = true;
    kebabPanel.setAttribute("aria-hidden", "true");
  });

  kebabDim?.addEventListener("click", () => {
    if (!kebabPanel) return;
    kebabPanel.hidden = true;
    kebabPanel.setAttribute("aria-hidden", "true");
  });

  // ===== Level buttons =====
  levelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const lvl = btn.dataset.level;
      if (!lvl) return;
      if (kebabPanel) {
        kebabPanel.hidden = true;
        kebabPanel.setAttribute("aria-hidden", "true");
      }
      loadLevel(lvl);
    });
  });

  // ===== CSV helpers =====
  function csvEscape(value) {
    if (value === null || value === undefined) return "";
    const v = String(value);
    if (/[",\n]/.test(v)) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }

  function buildCsv() {
    const yearLabel = `Year ${currentLevel}`;
    const header = ["Level", "To", "From", "Name", "Gender", "Id"];

    const lines = [];
    // header row
    lines.push(header.map(csvEscape).join(","));

    currentRows.forEach((r) => {
      const rowArr = [
        yearLabel,
        r.into ?? "",
        r.from ?? "",
        r.name ?? "",
        r.gender ?? "",
        r.id ?? "",
      ];
      lines.push(rowArr.map(csvEscape).join(","));
    });

    return lines.join("\r\n");
  }

  // ===== Download CSV (client-side) =====
  downloadBtn?.addEventListener("click", () => {
    const csv = buildCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    const now = new Date();
    const y = now.getFullYear();
    const levelLabel = `Year ${currentLevel}`;
    const filename = `${y} - ${levelLabel} - Trans out.csv`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ===== Attendance button (kebab menu) =====
  attendBtn?.addEventListener("click", () => {
    if (kebabPanel) {
      kebabPanel.hidden = true;
      kebabPanel.setAttribute("aria-hidden", "true");
    }
    window.location.href = "/shared/transfer/list/list-out/list-out.html";
  });

  // ===== Init =====
  if (subhead) subhead.textContent = `Year ${DEFAULT_LEVEL}`;
  loadLevel(DEFAULT_LEVEL);
})();
