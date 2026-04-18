/* /shared/profile/class.js — CLASS PROFILES */

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  /* ===== CONFIG ===== */
  const API_URL = "/.netlify/functions/class-info"; // Netlify proxy → Apps Script
  const EDIT_ROLES = ["CODER", "REGIS"];

  // ===== DOM lookups =====
  const kebabBtn   = document.getElementById("kebabBtn");
  const kebabPanel = document.getElementById("kebabPanel");
  const kebabDim   = document.getElementById("kebabDim");
  const subheading = document.getElementById("subheading");
  const statusMsg  = document.getElementById("statusMsg");
  const statusText = statusMsg ? statusMsg.querySelector(".statusText") : null;
  const dotsEl     = statusMsg ? statusMsg.querySelector(".dots") : null;

  const tableEl    = document.getElementById("classTable");

  const editBtn    = document.getElementById("editBtn");
  const saveBtn    = document.getElementById("saveBtn");
  const actionsWrap = document.querySelector(".actions"); // wrapper for buttons

  // NEW: footer below table (inside card) for TOTAL view
  const summaryFooter = document.getElementById("summaryFooter");

  const modal      = document.getElementById("rowModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalFT    = document.getElementById("modalFT");
  const modalAFT   = document.getElementById("modalAFT");
  const modalVenue = document.getElementById("modalVenue");

  // ===== Close button element group =====
  const els = {
    closeBtn: document.getElementById("closeBtn")
  };

  // ==== Exit button ====
  els.closeBtn?.addEventListener("click", (e) => {
    e.preventDefault(); // stop the anchor's own href navigation
    const route = (window.Auth && Auth.routeFor && Auth.routeFor(who.role)) || "/";
    location.assign(route);
  });

  // ===== state =====
  let currentYear = "7";
  let rowsData = [];
  let isEditMode = false;
  let canEdit    = false;
  let dotsTimer  = null;

  /* ===== Helpers ===== */

  // Priority:
  //   1. Auth.who().role
  //   2. localStorage.mspsbs_session.role
  function getRole() {
    try {
      if (window.Auth && typeof Auth.who === "function") {
        const w = Auth.who(); // {code, role} or null
        if (w && w.role) {
          const r = String(w.role).toUpperCase();
          console.log("[class.js] role from Auth.who():", r);
          return r;
        } else {
          console.log("[class.js] Auth.who() returned null or no role");
        }
      } else {
        console.log("[class.js] window.Auth not ready or no who()");
      }
    } catch (err) {
      console.log("[class.js] error calling Auth.who()", err);
    }

    try {
      const raw = localStorage.getItem("mspsbs_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.role) {
          const r = String(parsed.role).toUpperCase();
          console.log("[class.js] role from localStorage.mspsbs_session:", r);
          return r;
        }
      } else {
        console.log("[class.js] no mspsbs_session in localStorage");
      }
    } catch (err) {
      console.log("[class.js] error parsing mspsbs_session", err);
    }

    console.log("[class.js] final fallback: empty role");
    return "";
  }

  function showStatus(text, mode) {
    if (!statusMsg || !statusText) return;

    statusText.textContent = text || "";
    if (mode === "loading") {
      statusMsg.setAttribute("data-state", "loading");
      startDots();
    } else {
      statusMsg.setAttribute("data-state", mode || "idle");
      stopDots();
      if (dotsEl) dotsEl.textContent = "";
    }
  }

  // calm dots (no flashing, just ".", "..", "...")
  function startDots() {
    if (!dotsEl) return;
    stopDots();
    let step = 0;
    dotsTimer = setInterval(() => {
      step = (step + 1) % 4;
      dotsEl.textContent = ".".repeat(step);
    }, 500);
  }

  function stopDots() {
    if (dotsTimer) {
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
  }

  function yearLabel(y) {
    if (y === "TOTAL") return "All Classes Summary";
    return `Year ${y} Class`;
  }

  function esc(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ===== Render logic ===== */

  function renderTable() {
    if (!tableEl) return;
    if (currentYear === "TOTAL") {
      renderSummaryTable();
    } else {
      renderYearTable();
    }
  }

  function renderYearTable() {
    if (!tableEl) return;

    // clear footer when not on TOTAL view
    if (summaryFooter) summaryFooter.textContent = "";

    const theadHTML = `
      <thead>
        <tr>
          <th>CLASS</th>
          <th>FT</th>
          <th>AFT</th>
          <th>VENUE</th>
        </tr>
      </thead>
    `;

    const bodyHTML = rowsData
      .map((r, idx) => {
        const trAttrs = `data-idx="${idx}"`;
        const clsVal  = esc(r.cls);
        const ftVal   = esc(r.ft);
        const aftVal  = esc(r.aft);
        const venVal  = esc(r.venue);

        // ===== VIEW MODE (NOT editing) =====
        // Hide rows where CLASS is blank
        if (!isEditMode || !canEdit) {
          if (!clsVal) {
            return ""; // skip blank CLASS rows in view mode
          }
          return `
            <tr class="row" ${trAttrs}>
              <td>${clsVal}</td>
              <td>${ftVal}</td>
              <td>${aftVal}</td>
              <td>${venVal}</td>
            </tr>
          `;
        }

        // ===== EDIT MODE =====
        // Show ALL rows, including blank ones, as inputs
        return `
          <tr class="row" ${trAttrs}>
            <td><input class="cellInput" data-field="cls" data-idx="${idx}" value="${clsVal}"/></td>
            <td><input class="cellInput" data-field="ft" data-idx="${idx}" value="${ftVal}"/></td>
            <td><input class="cellInput" data-field="aft" data-idx="${idx}" value="${aftVal}"/></td>
            <td><input class="cellInput" data-field="venue" data-idx="${idx}" value="${venVal}"/></td>
          </tr>
        `;
      })
      .join("");

    tableEl.innerHTML = theadHTML + `<tbody>${bodyHTML}</tbody>`;

    attachRowHandlers();
    if (isEditMode && canEdit) {
      attachInputHandlers();
    }
  }

  // TOTAL view
  function renderSummaryTable() {
    if (!tableEl) return;

    const theadHTML = `
      <thead>
        <tr>
          <th>LEVEL</th>
          <th>TOTAL</th>
          <th>CLASSES</th>
        </tr>
      </thead>
    `;

    // grand total of ALL classes
    let totalCount = 0;
    if (typeof rowsData.totalAllYears !== "undefined") {
      totalCount = Number(rowsData.totalAllYears || 0);
    } else {
      rowsData.forEach((item) => {
        totalCount += Number(item.count || 0);
      });
    }

    const bodyHTML = rowsData
      .map((r, idx) => {
        const lvlText      = "Year " + esc(r.year);
        const classCount   = esc(String(r.count || 0));    // per-year total
        const classesLabel = esc(String(r.classes || "")); // e.g. CHAMPION

        return `
          <tr class="row" data-idx="${idx}">
            <td>${lvlText}</td>
            <td>${classCount}</td>
            <td>${classesLabel}</td>
          </tr>
        `;
      })
      .join("");

    tableEl.innerHTML = theadHTML + `<tbody>${bodyHTML}</tbody>`;

    // footer under table
    if (summaryFooter) {
      summaryFooter.textContent = `Total number of classes = ${totalCount}`;
    }
  }

  function attachRowHandlers() {
    if (!tableEl) return;
    const trs = tableEl.querySelectorAll("tbody tr.row");
    trs.forEach((tr) => {
      let tapTimeout = null;
      let tapCount = 0;

      tr.addEventListener("click", () => {
        tapCount++;
        if (tapCount === 1) {
          tapTimeout = setTimeout(() => {
            tapCount = 0;
          }, 250);
        } else if (tapCount === 2) {
          clearTimeout(tapTimeout);
          tapCount = 0;
          const idx = tr.getAttribute("data-idx");
          openModal(idx);
        }

        trs.forEach((row) => row.classList.remove("activeRow"));
        tr.classList.add("activeRow");
      });
    });
  }

  function attachInputHandlers() {
    if (!tableEl) return;
    const inputs = tableEl.querySelectorAll(".cellInput");
    inputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        const upper = inp.value.toUpperCase();
        inp.value = upper;
        const idx = Number(inp.getAttribute("data-idx"));
        const field = inp.getAttribute("data-field");
        if (rowsData[idx]) {
          rowsData[idx][field] = upper;
        }
      });
    });
  }

  function openModal(idx) {
    if (currentYear === "TOTAL") return;
    if (!modal || !modalTitle || !modalFT || !modalAFT || !modalVenue) return;

    const r = rowsData[idx];
    if (!r) return;

    modalTitle.textContent = (r.cls || "").toUpperCase();
    modalFT.textContent    = r.ft || "";
    modalAFT.textContent   = r.aft || "";
    modalVenue.textContent = r.venue || "";

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }

  /* ===== Fetch logic ===== */

  async function fetchYearData(y) {
    showStatus("Loading. Please wait", "loading");

    const url = `${API_URL}?mode=get&year=${encodeURIComponent(y)}`;
    const res = await fetch(url, { method: "GET" });
    const data = await res.json();

    console.log("fetchYearData response:", data);

    if (!data.ok) {
      showStatus("Error loading data", "idle");
      rowsData = [];
      renderTable();
      return;
    }

    rowsData = data.rows || [];
    showStatus("", "idle");
    renderTable();
  }

  async function fetchSummary() {
    showStatus("Loading. Please wait", "loading");

    const url = `${API_URL}?mode=total`;
    const res = await fetch(url, { method: "GET" });
    const data = await res.json();

    console.log("fetchSummary response:", data);

    if (!data.ok) {
      showStatus("Error loading data", "idle");
      rowsData = [];
      renderTable();
      return;
    }

    // yearly rows (Year 7, Year 8, ...)
    rowsData = Array.isArray(data.summary) ? data.summary.slice() : [];

    // store grand total so we can show it in footer
    rowsData.totalAllYears = data.total || 0;

    showStatus("", "idle");
    renderTable();
  }

  async function saveYearData(y) {
    showStatus("Editing mode", "edit");

    const payload = {
      mode: "save",
      year: y,
      rows: rowsData.map((r) => ({
        row:   r.row,
        cls:   (r.cls || "").toUpperCase(),
        ft:    (r.ft || "").toUpperCase(),
        aft:   (r.aft || "").toUpperCase(),
        venue: (r.venue || "").toUpperCase()
      }))
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    console.log("saveYearData response:", data);

    if (!data.ok) {
      showStatus("Save failed", "idle");
      return;
    }

    isEditMode = false;
    updateButtons();
    showStatus("Saved", "saved");

    if (currentYear === "TOTAL") {
      await fetchSummary();
    } else {
      await fetchYearData(currentYear);
    }
  }

  /* ===== UI actions ===== */

  function updateButtons() {
    if (!editBtn || !saveBtn) return;

    // Hide entire actions bar on TOTAL view or if user cannot edit
    if (currentYear === "TOTAL" || !canEdit) {
      if (actionsWrap) actionsWrap.style.display = "none";
      editBtn.disabled = true;
      saveBtn.disabled = true;
      return;
    }

    // Show actions when in a specific year AND user can edit
    if (actionsWrap) actionsWrap.style.display = "flex";

    if (isEditMode) {
      editBtn.disabled = true;
      saveBtn.disabled = false;
    } else {
      editBtn.disabled = false;
      saveBtn.disabled = true;
    }
  }

  function enterEditMode() {
    if (!canEdit || currentYear === "TOTAL") return;
    isEditMode = true;
    showStatus("Editing mode. Please wait", "edit");
    renderTable();
    updateButtons();
  }

  async function doSave() {
    if (!canEdit || currentYear === "TOTAL") return;
    await saveYearData(currentYear);
  }

  function setYearAndLoad(y) {
    currentYear = y;
    isEditMode = false;
    if (subheading) subheading.textContent = yearLabel(y);
    updateButtons();

    if (y === "TOTAL") {
      fetchSummary();
    } else {
      fetchYearData(y);
    }
  }

  function openKebab() {
    if (!kebabPanel) return;
    kebabPanel.hidden = false;
    kebabPanel.setAttribute("aria-hidden", "false");
  }

  function closeKebab() {
    if (!kebabPanel) return;
    kebabPanel.hidden = true;
    kebabPanel.setAttribute("aria-hidden", "true");
  }

  /* ===== Event listeners ===== */

  if (kebabBtn) {
    kebabBtn.addEventListener("click", openKebab);
  }
  if (kebabDim) {
    kebabDim.addEventListener("click", closeKebab);
  }

  const panelCloseBtn = document.getElementById("panelCloseBtn");
  if (panelCloseBtn) {
    panelCloseBtn.addEventListener("click", closeKebab);
  }

  if (kebabPanel) {
    kebabPanel.querySelectorAll(".panel-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const y = btn.getAttribute("data-year");
        if (!y) return;
        closeKebab();
        setYearAndLoad(y);
      });
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.matches("[data-close-modal]")) {
        closeModal();
      }
    });
  }

  if (editBtn) {
    editBtn.addEventListener("click", enterEditMode);
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", doSave);
  }

  /* ===== Init after DOM loaded ===== */
  window.addEventListener("DOMContentLoaded", () => {
    const role = getRole();
    canEdit = EDIT_ROLES.includes(role);

    console.log("[class.js] detected role =", role, "canEdit =", canEdit);

    currentYear = "7";
    if (subheading) {
      subheading.textContent = yearLabel(currentYear);
    }

    updateButtons();
    setYearAndLoad(currentYear);
  });
})();
