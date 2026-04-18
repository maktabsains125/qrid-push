/* daily-reports.js
 * REGIS/CODER/ADMIN only
 * - Level buttons load classes from backend
 * - Class button starts a session using classKey (e.g. "7A")
 * - REGIS/CODER editable; ADMIN readonly
 * - Adds a 9th button "PAST" after classes, ONLY visible after level loaded
 */
(function () {
  "use strict";

  // ===== Guard =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    location.replace("/");
    return;
  }

  const role = String(who.role || "").toUpperCase().trim();
  if (!["REGIS", "CODER", "ADMIN"].includes(role)) {
    location.replace(Auth.routeFor(role));
    return;
  }

  // ===== Config =====
  const API = "/.netlify/functions/daily-reports-netlify";

  // Level -> PAST sheet URL
  const PAST_URL = {
    "7":  "https://docs.google.com/spreadsheets/d/1ga5Mp0hkSYljXxTYpbMxZyjo5ifRU4fUHlHDtRnwBOA",
    "8":  "https://docs.google.com/spreadsheets/d/1j7aqlucGIgCh_ctBiYc9uQp5Wl8YSmZxQfu7Ea5_ego/",
    "9":  "https://docs.google.com/spreadsheets/d/1IbShlzSb4DXraBLqJ8eSjbMPwwYn7BVbHq9ywXt2LOs/",
    "10": "https://docs.google.com/spreadsheets/d/154cfb5qeef0ovv8EdUfW9i9SaBUmkiMEI0pJvlb6Svk",
    "12": "https://docs.google.com/spreadsheets/d/12Yc3p75JPW1l8gb3fa30763s0VtfqzsG5R7YFosXae8",
    "13": "https://docs.google.com/spreadsheets/d/1kj8DM8BlI2hpPMbjWdK_SlvUrRYISa4fSZIivqxgRVA"
  };

  // ===== DOM =====
  const $ = (id) => document.getElementById(id);

  const whoBadge = $("whoBadge");
  const metaBadge = $("metaBadge");
  const statusEl = $("status");
  const closeBtn = $("closeBtn");

  const levelRow = $("levelRow");
  const classGrid = $("classGrid");

  const tabGrid = $("tabGrid");
  const tabRemarks = $("tabRemarks");

  const gridCard = $("gridCard");
  const remarksCard = $("remarksCard");

  const saveBtn = $("saveBtn");
  const refreshBtn = $("refreshBtn");

  const tableWrap = $("tableWrap");
  const remarksBody = $("remarksBody");

  // ===== State =====
  let CURRENT_LEVEL = "7";
  let CURRENT_CLASSKEY = "";
  let TOKEN = null;
  let READONLY = role === "ADMIN";

  // PAST button ref
  let pastBtn = null;

  // ===== UI helpers =====
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }
  function setMeta(msg) {
    if (metaBadge) metaBadge.textContent = msg || "—";
  }

  function setActiveLevelChip(level) {
    const btns = levelRow ? levelRow.querySelectorAll("button[data-level]") : [];
    btns.forEach((b) => {
      b.classList.toggle("isActive", String(b.dataset.level) === String(level));
    });
  }

  // Remove PAST from DOM (so it's not visible)
  function removePastButton() {
    if (pastBtn && pastBtn.parentNode) pastBtn.parentNode.removeChild(pastBtn);
  }

  // Add PAST at the end (only after level is loaded)
  function addPastButton() {
    if (!classGrid) return;

    const url = PAST_URL[String(CURRENT_LEVEL)];
    if (!url) {
      removePastButton();
      return;
    }

    if (!pastBtn) {
      pastBtn = document.createElement("button");
      pastBtn.type = "button";
      pastBtn.className = "classBtn"; // same styling as class buttons
      pastBtn.id = "pastBtn";
      pastBtn.textContent = "PAST";

      pastBtn.addEventListener("click", () => {
        const u = PAST_URL[String(CURRENT_LEVEL)];
        if (!u) return;
        window.open(u, "_blank", "noopener");
      });
    }

    // ensure last
    classGrid.appendChild(pastBtn);
    pastBtn.title = `Open past records for Level ${CURRENT_LEVEL}`;
  }

  closeBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.assign(Auth.routeFor(role));
  });

  // ===== Network =====
  async function post(path, payload) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ path }, payload || {})),
    });

    const txt = await res.text();
    let data = null;
    try {
      data = JSON.parse(txt);
    } catch {
      throw new Error("Server returned bad JSON");
    }
    if (!data.ok) throw new Error(data.error || "Server error");
    return data;
  }

  // ===== Load classes =====
  async function loadClasses(level) {
    CURRENT_LEVEL = String(level);
    setActiveLevelChip(CURRENT_LEVEL);

    // hide PAST until the level finishes loading
    removePastButton();

    classGrid.innerHTML = "";
    setStatus("Loading classes…");

    const r = await post("classes.list", { level: CURRENT_LEVEL });
    const classes = r.classes || [];

    if (!classes.length) {
      classGrid.innerHTML = `<div class="empty">No classes found in FT map.</div>`;
      // level is still "loaded" (request succeeded), so show PAST now
      addPastButton();
      setStatus("");
      return;
    }

    const frag = document.createDocumentFragment();
    classes.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "classBtn";
      btn.textContent = item.classKey;
      btn.dataset.classkey = item.classKey;
      btn.addEventListener("click", () => startClass(item.classKey));
      frag.appendChild(btn);
    });

    classGrid.appendChild(frag);

    // level loaded successfully -> show PAST (9th button)
    addPastButton();

    setStatus("");
  }

  // ===== Start session =====
  async function startClass(classKey) {
    CURRENT_CLASSKEY = String(classKey || "").toUpperCase();
    setStatus("Loading table…");
    setMeta(`Class: ${CURRENT_CLASSKEY} • ${READONLY ? "VIEW ONLY" : "EDIT"}`);

    const r = await post("session.start", {
      user: String(who.code || "").toUpperCase(),
      role,
      classKey: CURRENT_CLASSKEY,
    });

    TOKEN = r.token;
    READONLY = !!(r.meta && r.meta.readonly);

    if (saveBtn) saveBtn.disabled = READONLY;
    if (saveBtn) saveBtn.title = READONLY ? "Admin is view-only" : "Save changes";

    renderGrid(r.grid?.data || [], r.grid?.formats?.fRed || []);
    await loadRemarks();
    setStatus("");
  }

  // ===== Tabs =====
  function selectTab(which) {
    const showGrid = which === "grid";
    tabGrid?.setAttribute("aria-selected", String(showGrid));
    tabRemarks?.setAttribute("aria-selected", String(!showGrid));
    gridCard?.classList.toggle("hidden", !showGrid);
    remarksCard?.classList.toggle("hidden", showGrid);
  }
  tabGrid?.addEventListener("click", () => selectTab("grid"));
  tabRemarks?.addEventListener("click", () => selectTab("remarks"));

  // ===== Grid helpers =====
  function todayDdMm() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  }

  // ===== Sticky col offsets (A and E) =====
  function applyStickyOffsets() {
    const tbl = tableWrap?.querySelector("table");
    if (!tbl) return;

    const firstCell = tbl.querySelector("tr td.c0");
    if (!firstCell) return;

    const w = Math.ceil(firstCell.getBoundingClientRect().width);
    tbl.style.setProperty("--c0w", w + "px");
  }

  window.addEventListener("resize", () => {
    requestAnimationFrame(applyStickyOffsets);
  });

  // ===== Edit batching =====
  let pending = [];
  let sending = false;
  let flushTimer = 0;

  function queueEdit(row, col, value) {
    pending.push({ row, col, value });
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushEdits, 250);
  }

  async function flushEdits() {
    if (READONLY) {
      pending = [];
      return;
    }
    if (sending || pending.length === 0 || !TOKEN) return;

    const edits = pending.slice();
    pending = [];
    sending = true;

    try {
      await post("grid.update", { token: TOKEN, edits });
    } finally {
      sending = false;
    }
  }

  // ===== Render grid =====
  function renderGrid(data, fRed) {
    const tbl = document.createElement("table");

    const colCount = data.length ? data[0].length : 0;
    const totalColIdx = colCount >= 2 ? colCount - 2 : -1;
    const totalPctIdx = colCount >= 1 ? colCount - 1 : -1;

    const todayKey = todayDdMm();
    let todayColIndex = -1;

    if (data.length >= 4) {
      const hdr = data[3];
      for (let c = 5; c <= 27; c++) {
        const v = hdr && hdr[c];
        if (typeof v === "string" && v.trim() === todayKey) {
          todayColIndex = c;
          break;
        }
      }
    }

    let lastDateColIndex = -1;
    if (data.length >= 4) {
      const hdr = data[3];
      for (let c = 27; c >= 5; c--) {
        const v = hdr && hdr[c];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          lastDateColIndex = c;
          break;
        }
      }
    }

    const visibleCols = [];
    for (let c = 0; c < colCount; c++) {
      if (c <= 4) {
        visibleCols.push(c);
        continue;
      }
      if (c >= 5 && c <= 27) {
        if (lastDateColIndex >= 5 && c <= lastDateColIndex) visibleCols.push(c);
        continue;
      }
      visibleCols.push(c);
    }

    for (let r = 0; r < data.length; r++) {
      if (r === 0) continue;

      const row = data[r];
      const sheetRow = r + 1;

      if (sheetRow >= 7 && sheetRow <= 40) {
        const nameVal = row[2];
        if (nameVal == null || String(nameVal).trim() === "") continue;
      }

      const tr = document.createElement("tr");

      for (const c of visibleCols) {
        const td = document.createElement("td");
        const div = document.createElement("div");
        div.className = "clip";

        if (c === totalColIdx) td.classList.add("totalCol");
        if (c === totalPctIdx) td.classList.add("totalPctCol");

        if (c === 0) td.classList.add("c0");
        if (c === 4) td.classList.add("c4");

        if (r === 3) td.classList.add("r4");

        if (todayColIndex >= 0 && c === todayColIndex && sheetRow >= 6 && sheetRow <= 40) {
          td.classList.add("isToday");
        }

        div.textContent = row[c] == null ? "" : row[c];

        if (r === 3 && c === totalColIdx) div.textContent = "Total";
        if (r === 3 && c === totalPctIdx) div.textContent = "Total %";

        const inEditableRows = r >= 5 && r <= 39;
        const inEditableCols = c >= 4 && c <= 27;

        if (!READONLY && inEditableRows && inEditableCols) {
          td.classList.add("editable");
          div.contentEditable = "true";

          div.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              div.blur();
            }
          });

          div.addEventListener("input", () => {
            if (c !== 4) {
              const sel = window.getSelection();
              const range = document.createRange();
              div.textContent = div.textContent.toUpperCase();
              range.selectNodeContents(div);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          });

          div.addEventListener("blur", () => {
            const raw = div.textContent.trim();
            const value = c === 4 ? raw : raw.toUpperCase();
            queueEdit(r + 1, c + 1, value);
          });
        }

        if (c === 5 && r >= 5 && r <= 39) {
          const idx = r - 5;
          if (Array.isArray(fRed) && fRed[idx]) td.classList.add("fRed");
        }

        td.appendChild(div);
        tr.appendChild(td);
      }

      tbl.appendChild(tr);
    }

    tableWrap.innerHTML = "";
    tableWrap.appendChild(tbl);

    requestAnimationFrame(applyStickyOffsets);
  }

  // ===== Remarks =====
  async function loadRemarks() {
    if (!TOKEN) return;
    const r = await post("remarks.fetch", { token: TOKEN });
    renderRemarks(r.data || []);
  }

  function renderRemarks(rows) {
    remarksBody.innerHTML = "";
    for (let i = 0; i < rows.length; i++) {
      const tr = document.createElement("tr");

      const td0 = document.createElement("td");
      td0.textContent = rows[i][0] || "";

      const td1 = document.createElement("td");
      td1.textContent = rows[i][1] || "";

      const td2 = document.createElement("td");
      const div = document.createElement("div");
      div.className = "rclip";
      div.textContent = rows[i][2] || "";

      if (!READONLY) {
        td2.classList.add("editable");
        div.contentEditable = "true";
        div.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            div.blur();
          }
        });
        div.addEventListener("blur", async () => {
          const value = div.textContent.trim();
          try {
            await post("remarks.update", { token: TOKEN, rows: [{ rowOffset: i, value }] });
          } catch (e) {
            setStatus("Remarks save failed");
            setTimeout(() => setStatus(""), 1200);
          }
        });
      } else {
        td2.classList.add("readonly");
      }

      td2.appendChild(div);

      tr.appendChild(td0);
      tr.appendChild(td1);
      tr.appendChild(td2);
      remarksBody.appendChild(tr);
    }
  }

  // ===== Save / Refresh =====
  saveBtn?.addEventListener("click", async () => {
    if (READONLY) return;
    try {
      setStatus("Saving…");
      await flushEdits();
      const out = await post("grid.fetch", { token: TOKEN });
      renderGrid(out.data || [], out.formats?.fRed || []);
      await loadRemarks();
      setStatus("Saved");
      setTimeout(() => setStatus(""), 900);
    } catch (e) {
      setStatus("Save failed");
      setTimeout(() => setStatus(""), 1200);
    }
  });

  refreshBtn?.addEventListener("click", async () => {
    try {
      setStatus("Refreshing…");
      await flushEdits();
      const out = await post("grid.fetch", { token: TOKEN });
      renderGrid(out.data || [], out.formats?.fRed || []);
      await loadRemarks();
      setStatus("Refreshed");
      setTimeout(() => setStatus(""), 800);
    } catch (e) {
      setStatus("Refresh failed");
      setTimeout(() => setStatus(""), 1200);
    }
  });

  // ===== Boot =====
  window.addEventListener("DOMContentLoaded", async () => {
    if (whoBadge) whoBadge.textContent = `${String(who.code || "").toUpperCase()} (${role})`;
    if (saveBtn) saveBtn.disabled = READONLY;

    levelRow?.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-level]");
      if (!btn) return;
      const lvl = String(btn.dataset.level || "");
      loadClasses(lvl).catch(() => setStatus("Failed to load classes"));
    });

    setActiveLevelChip(CURRENT_LEVEL);
    selectTab("grid");

    // On first boot, it will only appear AFTER loadClasses finishes
    await loadClasses(CURRENT_LEVEL);

    setStatus("Select a class.");
  });
})();
