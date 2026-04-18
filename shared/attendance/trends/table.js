/* /shared/trends/table.js — Attendance TRENDS tables (levels + groupings, with % formatting + sticky row classes) */

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // Same role gate as trends charts
  const role = String(who.role || "").toUpperCase().trim();
  const BLOCKED = ["FT", "HEP", "WELFARE", "GENERAL", ""];

  if (BLOCKED.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return;
  }

  const API_URL = "/.netlify/functions/trends";

  const $ = (s, root = document) => root.querySelector(s);

  const loadStatus = $("#loadStatus");
  const exitBtn    = $("#exitBtn");
  const tblLevels  = $("#tblLevels");
  const tblGroups  = $("#tblGroups");

  addExitHandler();
  init();

  function addExitHandler() {
    if (!exitBtn) return;
    exitBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (document.referrer) history.back();
      else location.href = "/";
    });
  }

  async function init() {
    showStatus(true);
    try {
      const url = `${API_URL}?action=tables&t=${Date.now()}`;
      const data = await fetchJson(url);

      // Levels table: headersLevels + rowsLevels
      if (tblLevels) {
        renderTable(
          tblLevels,
          data.headersLevels || [],
          data.rowsLevels || []
        );
      }

      // Groupings table: headersGroups + rowsGroups
      if (tblGroups) {
        renderTable(
          tblGroups,
          data.headersGroups || [],
          data.rowsGroups || []
        );
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load attendance tables.");
    } finally {
      showStatus(false);
    }
  }

  function showStatus(on) {
    if (loadStatus) loadStatus.classList.toggle("hidden", !on);
  }

  // Format cell:
  // - numbers between 0 and 1 => 2dp percentage
  // - other numbers => as is
  // - strings => as is
  function formatCell(cell) {
    if (cell === null || typeof cell === "undefined" || cell === "") return "";
    if (typeof cell === "number") {
      if (cell >= 0 && cell <= 1) {
        return (cell * 100).toFixed(2) + "%";
      }
      return String(cell);
    }
    // if already a string with %, or any text, just show it
    return String(cell);
  }

  function renderTable(tableEl, headerRows, bodyRows) {
    tableEl.innerHTML = "";

    headerRows = headerRows || [];
    bodyRows   = bodyRows   || [];

    // ===== SPECIAL CASE:
    // If there is only 1 header row, promote the first body row
    // to become the 2nd header row (for sticky header behaviour).
    if (headerRows.length === 1 && bodyRows.length > 0) {
      const promoted = bodyRows[0];
      headerRows = headerRows.slice(); // shallow copy
      headerRows.push(promoted);
      bodyRows = bodyRows.slice(1);
    }

    const thead = document.createElement("thead");
    headerRows.forEach((rowArr) => {
      const tr = document.createElement("tr");
      rowArr.forEach((cell) => {
        const th = document.createElement("th");
        th.textContent = formatCell(cell);
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    });

    const tbody = document.createElement("tbody");
    bodyRows.forEach((rowArr) => {
      const hasValue = rowArr.some(
        (v) => v !== "" && v !== null && typeof v !== "undefined"
      );
      if (!hasValue) return;

      const tr = document.createElement("tr");
      rowArr.forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = formatCell(cell);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    tableEl.appendChild(thead);
    tableEl.appendChild(tbody);

    // Tag the first two header rows as sticky for this table
    markStickyRows(tableEl);
  }

  /**
   * Make the first 2 HEADER rows sticky for this specific table.
   * Works for both tables independently.
   */
  function markStickyRows(tableEl) {
  if (!tableEl) return;

  // Clear any old sticky styles/classes
  Array.from(tableEl.rows).forEach((row) => {
    row.classList.remove("sticky-row-1", "sticky-row-2");
    Array.from(row.cells).forEach((cell) => {
      cell.style.position = "";
      cell.style.top = "";
      cell.style.zIndex = "";
      cell.style.background = "";
    });
  });

  const rows = Array.from(tableEl.rows);
  if (rows.length === 0) return;

  // ===== First sticky row: ALWAYS the very first row in the table =====
  const firstRow = rows[0];
  firstRow.classList.add("sticky-row-1");
  Array.from(firstRow.cells).forEach((cell) => {
    cell.style.position  = "sticky";
    cell.style.top       = "0px";
    cell.style.zIndex    = "3";
    cell.style.background = "#f4f4f7";
  });

  // ===== Second sticky row: the very next row, if it exists =====
  if (rows.length > 1) {
    const secondRow = rows[1];
    secondRow.classList.add("sticky-row-2");

    // Measure the first row height so the 2nd sits directly under it
    const firstHeight =
      firstRow.getBoundingClientRect().height ||
      firstRow.offsetHeight ||
      24; // fallback

    Array.from(secondRow.cells).forEach((cell) => {
      cell.style.position  = "sticky";
      cell.style.top       = firstHeight + "px";
      cell.style.zIndex    = "3";
      cell.style.background = "#f4f4f7";
    });
  }
}


  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
})();
