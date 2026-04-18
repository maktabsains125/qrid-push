// ===== LOCK to signed in user only =====

(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // ===== ROLE ALLOW-LIST: only these roles may use Welfare page =====
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED_ROLES = ["WELFARE", "ADMIN", "REGIS", "CODER"];

  if (!ALLOWED_ROLES.includes(role)) {
    // Any other role: no access to Welfare
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return; // stop everything else
  }

  // ================== CONFIG ==================
  const BACKEND_URL = "/.netlify/functions/welfare-proxy"; // same-origin proxy
  const DEFAULT_LEVEL = "";        // user must pick a level
  const DEFAULT_WELFARE = "";      // empty => All types
  const CACHE_SECONDS = 20;
  const NET_TIMEOUT_MS = 20000;

  // ================== STATE (column visibility) ==================
  const state = {
    level: { hiddenCols: new Set() },
    all: { hiddenCols: new Set() },
  };

  // ================== DOM ==================
  const tabLevel = byId("tabLevel");
  const tabAll = byId("tabAll");
  const levelPane = byId("levelPane");
  const allPane = byId("allPane");
  const levelSel = byId("levelSel");
  const welfareSel = byId("welfareSel");
  const levelStatus = byId("levelStatus");
  const levelThead = byId("levelThead");
  const levelTbody = byId("levelTbody");
  const allStatus = byId("allStatus");
  const allThead = byId("allThead");
  const allTbody = byId("allTbody");

  // Optional controls
  const btnColumns = byId("btnColumns");
  const btnWrap = byId("btnWrap");
  const btnDensity = byId("btnDensity");
  const btnColumnsAll = byId("btnColumnsAll");
  const btnWrapAll = byId("btnWrapAll");
  const btnDensityAll = byId("btnDensityAll");

  // Close button → /shared/profile/index.html
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "closeTop") {
      location.href = "/shared/profile/index.html";
    }
  });

  // ================== INIT ==================
  document.addEventListener("DOMContentLoaded", () => {
    if (levelSel && !levelSel.value) levelSel.value = DEFAULT_LEVEL;
    if (welfareSel && !welfareSel.value) welfareSel.value = DEFAULT_WELFARE;

    tabLevel?.addEventListener("click", () => activateTab("level"));
    tabAll?.addEventListener("click", () => activateTab("all"));

    levelSel?.addEventListener("change", reloadLevel);
    welfareSel?.addEventListener("change", reloadLevel);

    // Controls (Level)
    btnWrap?.addEventListener("click", () => {
      const tbl = qsel("#levelPane .table");
      const pressed = tbl?.classList.toggle("wrap");
      if (pressed != null) btnWrap.setAttribute("aria-pressed", String(pressed));
    });
    btnDensity?.addEventListener("click", () => {
      const tbl = qsel("#levelPane .table");
      const pressed = tbl?.classList.toggle("compact");
      if (pressed != null) btnDensity.setAttribute("aria-pressed", String(pressed));
    });
    btnColumns?.addEventListener("click", () => {
      const headers = [...document.querySelectorAll("#levelPane thead th")].map(
        (th) => th.textContent || ""
      );
      buildColumnChooser(
        headers,
        (newHidden) => {
          state.level.hiddenCols = newHidden;
          applyColumnVisibility(qsel("#levelPane table"), state.level.hiddenCols);
        },
        state.level.hiddenCols
      );
    });

    // Controls (ALL)
    btnWrapAll?.addEventListener("click", () => {
      const tbl = qsel("#allPane .table");
      const pressed = tbl?.classList.toggle("wrap");
      if (pressed != null) btnWrapAll.setAttribute("aria-pressed", String(pressed));
    });
    btnDensityAll?.addEventListener("click", () => {
      const tbl = qsel("#allPane .table");
      const pressed = tbl?.classList.toggle("compact");
      if (pressed != null) btnDensityAll.setAttribute("aria-pressed", String(pressed));
    });
    btnColumnsAll?.addEventListener("click", () => {
      const headers = [...document.querySelectorAll("#allPane thead th")].map(
        (th) => th.textContent || ""
      );
      buildColumnChooser(
        headers,
        (newHidden) => {
          state.all.hiddenCols = newHidden;
          applyColumnVisibility(qsel("#allPane table"), state.all.hiddenCols);
        },
        state.all.hiddenCols
      );
    });

    byId("modalClose")?.addEventListener("click", closeModal);
    qsel("#rowModal .modal__backdrop")?.addEventListener("click", closeModal);

    activateTab("level");
    // Load only when Level chosen (Welfare can be empty = All types)
    if (levelSel.value) reloadLevel();
    else setStatus(levelStatus, "Please select Level and Welfare type to display data.");
  });

  function activateTab(which) {
    if (which === "level") {
      tabLevel?.classList.add("tab--active");
      tabAll?.classList.remove("tab--active");
      levelPane.hidden = false;
      allPane.hidden = true;
    } else {
      tabAll?.classList.add("tab--active");
      tabLevel?.classList.remove("tab--active");
      levelPane.hidden = true;
      allPane.hidden = false;
      reloadAll();
    }
  }

  // ================== FETCH ==================
  function abortableFetch(url, options = {}, timeoutMs = NET_TIMEOUT_MS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { ...options, signal: ctrl.signal }).finally(() =>
      clearTimeout(t)
    );
  }

  async function fetchJSON(url) {
    const res = await abortableFetch(url, { mode: "cors" });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Bad JSON: ${text.slice(0, 200)}`);
    }
  }

  async function fetchData(params) {
    assertBackendSet();
    const u = new URL(BACKEND_URL, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) u.searchParams.set(k, v);
    });
    u.searchParams.set("cache", String(CACHE_SECONDS));
    return await fetchJSON(u.toString());
  }

  // ================== LOADERS ==================
  async function reloadLevel() {
    const level = (levelSel?.value || "").trim();
    const welfare = (welfareSel?.value || "").trim(); // "" => All types
    if (!level) {
      setStatus(levelStatus, "Please select Level and Welfare type to display data.");
      renderTable(levelThead, levelTbody, [], []);
      return;
    }

    setStatus(levelStatus, `Loading ${level} • ${welfare || "All types"}…`);
    try {
      const data = await fetchData({ sheet: level, welfare });
      if (!data.ok) throw new Error(data.error || "Backend error");

      renderTable(levelThead, levelTbody, data.header, data.rows);
      applyColumnVisibility(qsel("#levelPane table"), state.level.hiddenCols);

      setStatus(
        levelStatus,
        data.rows.length
          ? `Showing ${level} • ${welfare || "All types"} (${data.rows.length} rows)`
          : `No rows for ${level} • ${welfare || "All types"}`
      );
    } catch (err) {
      setStatus(levelStatus, "Error: " + err.message);
      renderTable(levelThead, levelTbody, [], []);
      console.error(err);
    }
  }

  async function reloadAll() {
    setStatus(allStatus, "Loading ALL…");
    try {
      const data = await fetchData({ sheet: "ALL" });
      if (!data.ok) throw new Error(data.error || "Backend error");

      renderTable(allThead, allTbody, data.header, data.rows);
      applyColumnVisibility(qsel("#allPane table"), state.all.hiddenCols);

      setStatus(
        allStatus,
        data.rows.length ? `Showing ALL (${data.rows.length} rows)` : `No rows on ALL sheet`
      );
    } catch (err) {
      setStatus(allStatus, "Error: " + err.message);
      renderTable(allThead, allTbody, [], []);
      console.error(err);
    }
  }

  // ================== RENDER ==================
  function renderTable(theadEl, tbodyEl, header, rows) {
    const table = theadEl?.closest("table");

    // Build the header the way we want to DISPLAY it:
    //   ["No.", ...sheet headers starting from column B]
    const displayHeader = ["No.", ...(header || []).slice(1)];

    // Ensure colgroup matches display header
    if (table) {
      let cg = table.querySelector("colgroup");
      if (!cg) {
        cg = document.createElement("colgroup");
        table.insertBefore(cg, table.firstChild);
      }
      cg.innerHTML = "";
      for (let i = 0; i < displayHeader.length; i++) {
        cg.appendChild(document.createElement("col"));
      }
    }

    // Render THEAD with the display header
    if (theadEl) {
      theadEl.innerHTML = "";
      const trH = document.createElement("tr");
      displayHeader.forEach((h) => {
        const th = document.createElement("th");
        th.textContent = String(h || "");
        th.title = String(h || "");
        trH.appendChild(th);
      });
      theadEl.appendChild(trH);
    }

    // Render TBODY with: [sequence, ...row starting from column B]
    if (tbodyEl) {
      tbodyEl.innerHTML = "";
      (rows || []).forEach((r, i) => {
        const displayRow = [i + 1, ...r.slice(1)]; // <- skip sheet col A
        const tr = document.createElement("tr");

        displayRow.forEach((cell) => {
          const td = document.createElement("td");
          const text = cell == null ? "" : String(cell);
          td.textContent = text;
          td.title = text;
          tr.appendChild(td);
        });

        // Pass the display header/row to the modal so columns line up
        tr.addEventListener("click", () => openRowModal(displayHeader, displayRow));
        tbodyEl.appendChild(tr);
      });
    }
  }

  // ================== COLUMNS ==================
  function applyColumnVisibility(tableEl, hiddenSet) {
    if (!tableEl || !hiddenSet) return;
    const idxs = [...hiddenSet];
    const rows = tableEl.querySelectorAll("tr");
    rows.forEach((tr) => {
      [...tr.children].forEach((cell, i) => {
        if (idxs.includes(i)) cell.classList.add("col-hidden");
        else cell.classList.remove("col-hidden");
      });
    });
  }

  function buildColumnChooser(headers, onApply, initialHidden = new Set()) {
    const dialog = document.createElement("dialog");
    dialog.style.padding = "14px";
    dialog.style.maxWidth = "420px";

    const title = document.createElement("h3");
    title.textContent = "Columns";
    title.style.marginTop = "0";
    dialog.appendChild(title);

    const list = document.createElement("div");
    headers.forEach((name, i) => {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.margin = "6px 0";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !initialHidden.has(i);
      const span = document.createElement("span");
      span.textContent = name || `Col ${i + 1}`;
      row.appendChild(cb);
      row.appendChild(span);
      list.appendChild(row);
    });
    dialog.appendChild(list);

    const actions = document.createElement("div");
    actions.style.marginTop = "10px";
    const ok = document.createElement("button");
    ok.className = "pill";
    ok.textContent = "Apply";
    actions.appendChild(ok);
    dialog.appendChild(actions);

    document.body.appendChild(dialog);
    dialog.showModal();

    ok.addEventListener("click", () => {
      const boxes = list.querySelectorAll('input[type="checkbox"]');
      const nextHidden = new Set();
      boxes.forEach((cb, i) => {
        if (!cb.checked) nextHidden.add(i);
      });
      dialog.close();
      dialog.remove();
      onApply(nextHidden);
    });
  }

  // ================== MODAL ==================
  function openRowModal(header, row) {
    const modal = byId("rowModal");
    const body = byId("modalBody");
    if (!modal || !body) return;

    const dl = document.createElement("dl");
    dl.style.display = "grid";
    dl.style.gridTemplateColumns = "140px 1fr";
    dl.style.gap = "8px 12px";

    for (let i = 0; i < Math.max(header.length, row.length); i++) {
      const dt = document.createElement("dt");
      dt.textContent = header[i] || `Col ${i + 1}`;
      const dd = document.createElement("dd");
      dd.textContent = row[i] == null ? "" : String(row[i]);
      dl.appendChild(dt);
      dl.appendChild(dd);
    }

    body.innerHTML = "";
    body.appendChild(dl);
    modal.hidden = false;
  }

  function closeModal() {
    const modal = byId("rowModal");
    if (modal) modal.hidden = true;
  }

  // ================== UTILS ==================
  function byId(id){ return document.getElementById(id); }
  function qsel(sel){ return document.querySelector(sel); }
  function setStatus(el,msg){ if (el) el.textContent = msg || ""; }
  function assertBackendSet(){
    if (!BACKEND_URL){ throw new Error("BACKEND_URL not set"); }
  }
})();
