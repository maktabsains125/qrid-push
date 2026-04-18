/* /shared/displays/app.js — cache-first warm-up + in-place refresh (FULL, corrected)
 *
 * Fixes included:
 * ✅ "Send data to JSS" link will not be removed by renders (render overall into #overallCards)
 * ✅ Refresh click handler no longer hijacks other links (targets ONLY #refreshLink)
 * ✅ Safer DOM guards (won’t crash if some nodes missing)
 *
 * IMPORTANT HTML change expected:
 * - In Overall section, keep your static note/link in #overallWrap
 * - Add: <div id="overallCards"></div> where cards should render
 */

// ===== LOCK to signed in user only =====
(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // ===== CONFIG =====
  const PROXY = "/.netlify/functions/displays"; // same-origin proxy to GAS

  // Sessions (your new levels)
  const AM_SHEETS = ["9", "10", "12", "13"];
  const PM_SHEETS = ["7", "8"];
  const ALL_SHEETS = [...AM_SHEETS, ...PM_SHEETS];

  const RANGE = "B1:I21";

  // OVERALL
  const OVERALL_SHEETS = ["Overall"];
  const OVERALL_RANGE = "A1:F13";

  // ===== CACHE CONFIG =====
  const CACHE_KEY = "ms_displays_cache_v1";
  const CACHE_TTL = 60 * 1000; // 1 min freshness

  // ===== DOM =====
  const $ = (s, root = document) => root.querySelector(s);

  const amWrap = $("#amWrap");
  const pmWrap = $("#pmWrap");

  // overallWrap holds your static note + JSS link
  const overallWrap = $("#overallWrap");
  // overallCards is where we render the "Overall Summary" card(s)
  const overallCards = $("#overallCards") || overallWrap; // fallback: old HTML (but will overwrite)

  const tabAm = $("#tabAm");
  const tabPm = $("#tabPm");
  const tabOverall = $("#tabOverall");
  const exitBtn = $("#exitBtn");
  const loadStatus = $("#loadStatus");

  // ONLY the Update link (do not include .refreshLink class)
  const refreshLink = $("#refreshLink");

  // ===== Status row control =====
  function setStatus(text) {
    if (!loadStatus) return;
    loadStatus.innerHTML =
      `<span class="statusText"><strong>${text}</strong>` +
      `<span class="dots" aria-hidden="true"></span></span>`;
    loadStatus.style.display = ""; // show
  }
  function hideStatus() {
    if (!loadStatus) return;
    loadStatus.style.display = "none"; // keep node for reuse
  }

  // ===== Tabs =====
  function activate(tab) {
    [tabAm, tabPm, tabOverall].forEach((b) => b && b.setAttribute("aria-selected", "false"));
    [tabAm, tabPm, tabOverall].forEach((b) => b && b.classList.remove("active"));
    tab && tab.setAttribute("aria-selected", "true");
    tab && tab.classList.add("active");

    if (tab === tabAm) {
      amWrap && amWrap.classList.remove("hidden");
      pmWrap && pmWrap.classList.add("hidden");
      overallWrap && overallWrap.classList.add("hidden");
    } else if (tab === tabPm) {
      amWrap && amWrap.classList.add("hidden");
      pmWrap && pmWrap.classList.remove("hidden");
      overallWrap && overallWrap.classList.add("hidden");
    } else {
      amWrap && amWrap.classList.add("hidden");
      pmWrap && pmWrap.classList.add("hidden");
      overallWrap && overallWrap.classList.remove("hidden");
    }
  }

  tabAm && tabAm.addEventListener("click", () => activate(tabAm));
  tabPm && tabPm.addEventListener("click", () => activate(tabPm));
  tabOverall && tabOverall.addEventListener("click", () => activate(tabOverall));

  // ==== Exit button ====
  exitBtn &&
    exitBtn.addEventListener("click", () => {
      const route = (window.Auth && Auth.routeFor && Auth.routeFor(who.role)) || "/";
      location.assign(route);
    });

  // ===== Skeleton cards (instant UI) =====
  function skeletonCard(title) {
    const card = document.createElement("div");
    card.className = "card skeleton";
    card.innerHTML = `
      <div class="cardHead">${title}</div>
      <div class="tableWrap">
        <div class="skeletonRow"></div>
        <div class="skeletonRow"></div>
        <div class="skeletonRow"></div>
      </div>`;
    return card;
  }

  function showInitialSkeletons() {
    if (amWrap) amWrap.innerHTML = "";
    if (pmWrap) pmWrap.innerHTML = "";
    if (overallCards) overallCards.innerHTML = "";

    AM_SHEETS.forEach((s) => amWrap && amWrap.appendChild(skeletonCard(`Year ${s}`)));
    PM_SHEETS.forEach((s) => pmWrap && pmWrap.appendChild(skeletonCard(`Year ${s}`)));
    overallCards && overallCards.appendChild(skeletonCard("Overall Summary"));
  }
  showInitialSkeletons();

  // ===== Fetch (with optional timeout) =====
  function fetchMaybeTimeout(url, ms) {
    if (ms == null) {
      return fetch(url, { method: "GET", cache: "no-store" });
    }
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { method: "GET", cache: "no-store", signal: ctrl.signal }).finally(() =>
      clearTimeout(id)
    );
  }

  async function loadSheets(sheets, range, { timeoutMs = 3000, cacheSec = 20, compact = 1 } = {}) {
    const url =
      `${PROXY}?sheets=${encodeURIComponent(sheets.join(","))}` +
      `&range=${encodeURIComponent(range)}` +
      `&cache=${encodeURIComponent(String(cacheSec))}` +
      `&compact=${encodeURIComponent(String(compact))}` +
      `&ts=${Date.now()}`; // cache-buster
    const res = await fetchMaybeTimeout(url, timeoutMs);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ===== Render helpers =====
  const yearTitle = (name) => {
    if (/^(7|8|9|10|12|13)$/.test(String(name))) return `Year ${name}`;
    if (String(name).toLowerCase() === "overall") return "Overall Summary";
    return `Sheet ${name}`;
  };

  function renderTable(values, opts = { headHL: false, bodyHL: new Set(), bodyHLFromEnd: [] }) {
    const table = document.createElement("table");
    table.className = "table";
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    if (values && values.length) {
      const maxCols = Math.max(...values.map((r) => (r ? r.length : 0)), 0) || 0;

      // HEADER
      const header = document.createElement("tr");
      if (opts.headHL) header.classList.add("hl-head");
      for (let c = 0; c < maxCols; c++) {
        const th = document.createElement("th");
        th.textContent = values[0] && values[0][c] != null ? String(values[0][c]) : "";
        header.appendChild(th);
      }
      thead.appendChild(header);

      // Dynamic highlight set
      const bodyCount = Math.max(values.length - 1, 0);
      const dynSet = new Set();
      (opts.bodyHLFromEnd || []).forEach((k) => {
        if (k >= 1 && bodyCount >= k) {
          const idxFromStart = bodyCount - (k - 1);
          dynSet.add(idxFromStart);
        }
      });

      // BODY
      for (let r = 1; r < values.length; r++) {
        const tr = document.createElement("tr");
        const bodyRowNumber = r;
        const mustHL =
          (opts.bodyHL && opts.bodyHL.has(bodyRowNumber)) || dynSet.has(bodyRowNumber);
        if (mustHL) tr.classList.add("hl-row");

        const row = values[r] || [];
        for (let c = 0; c < row.length; c++) {
          const td = document.createElement("td");
          td.textContent = row[c] == null ? "" : String(row[c]);
          tr.appendChild(td);
        }
        for (let c = row.length; c < maxCols; c++) {
          const td = document.createElement("td");
          td.textContent = "";
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }

  function makeCard(sheetName, values, opts) {
    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "cardHead";
    head.textContent = yearTitle(sheetName);

    const wrap = document.createElement("div");
    wrap.className = "tableWrap";
    wrap.appendChild(renderTable(values, opts));

    card.appendChild(head);
    card.appendChild(wrap);
    return card;
  }

  const yearOpts = { headHL: false, bodyHL: new Set([1]), bodyHLFromEnd: [3] };
  const perSheetOpts = Object.fromEntries(ALL_SHEETS.map((s) => [s, yearOpts]));
  const overallOpts = { Overall: { headHL: true, bodyHL: new Set([11, 12]), bodyHLFromEnd: [] } };

  function injectSplit(amContainer, pmContainer, payload) {
    const list = (payload && (payload.data || payload.sheets)) || [];
    const bySheet = new Map(list.map((item) => [String(item.sheet), item]));

    if (amContainer) amContainer.innerHTML = "";
    if (pmContainer) pmContainer.innerHTML = "";

    let added = false;

    AM_SHEETS.forEach((s) => {
      if (!amContainer) return;
      const data = bySheet.get(s);
      if (!data || data.error) {
        const c = document.createElement("div");
        c.className = "card";
        c.innerHTML = `<div class="cardHead">${yearTitle(
          s
        )}</div><div style="padding:12px">${data && data.error ? `Error: ${data.error}` : "No data"}</div>`;
        amContainer.appendChild(c);
      } else {
        amContainer.appendChild(makeCard(s, data.values || [], perSheetOpts[s]));
        added = true;
      }
    });

    PM_SHEETS.forEach((s) => {
      if (!pmContainer) return;
      const data = bySheet.get(s);
      if (!data || data.error) {
        const c = document.createElement("div");
        c.className = "card";
        c.innerHTML = `<div class="cardHead">${yearTitle(
          s
        )}</div><div style="padding:12px">${data && data.error ? `Error: ${data.error}` : "No data"}</div>`;
        pmContainer.appendChild(c);
      } else {
        pmContainer.appendChild(makeCard(s, data.values || [], perSheetOpts[s]));
        added = true;
      }
    });

    if (added) hideStatus();
  }

  function inject(container, payload, wanted, optsMap) {
    if (!container) return;

    container.innerHTML = "";
    const list = (payload && (payload.data || payload.sheets)) || [];
    const bySheet = new Map(list.map((item) => [String(item.sheet), item]));
    let added = false;

    wanted.forEach((s) => {
      const data = bySheet.get(String(s));
      const opts = (optsMap && optsMap[String(s)]) || {};
      if (!data || data.error) {
        const c = document.createElement("div");
        c.className = "card";
        c.innerHTML = `<div class="cardHead">${yearTitle(
          s
        )}</div><div style="padding:12px">${data && data.error ? `Error: ${data.error}` : "No data"}</div>`;
        container.appendChild(c);
      } else {
        container.appendChild(makeCard(s, data.values || [], opts));
        added = true;
      }
    });

    if (added) hideStatus();
  }

  async function loadWithRetry(sheets, range, tries = 2, timeoutMs = 3000) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        return await loadSheets(sheets, range, { timeoutMs, cacheSec: 20, compact: 1 });
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw lastErr;
  }

  // ===== Try cache first =====
  let showedCache = false;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      const fresh = cached && cached.t && Date.now() - cached.t < CACHE_TTL;

      if (fresh) {
        // Preferred shape: { t, ampm: <payload>, overall: <payload> }
        if (cached.ampm && cached.overall) {
          injectSplit(amWrap, pmWrap, cached.ampm);
          inject(overallCards, cached.overall, OVERALL_SHEETS, { Overall: overallOpts["Overall"] });
        } else {
          // Back-compat: a single payload for all sheets
          injectSplit(amWrap, pmWrap, cached.data || cached);
          inject(overallCards, cached.data || cached, OVERALL_SHEETS, { Overall: overallOpts["Overall"] });
        }
        showedCache = true;
        setStatus("Updating. Please wait");
      }
    }
  } catch (e) {
    console.warn("[Displays] cache read failed:", e);
  }

  // ===== Live load (AM/PM + Overall) =====
  async function loadLive() {
    try {
      const [p1, p2] = await Promise.all([
        loadWithRetry(ALL_SHEETS, RANGE, 2, null),
        loadWithRetry(OVERALL_SHEETS, OVERALL_RANGE, 2, null),
      ]);

      if (p1 && p1.ok) injectSplit(amWrap, pmWrap, p1);
      if (p2 && p2.ok) inject(overallCards, p2, OVERALL_SHEETS, { Overall: overallOpts["Overall"] });

      // Persist cache in the preferred 2-payload shape
      localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), ampm: p1, overall: p2 }));

      hideStatus();
    } catch (err) {
      setStatus(showedCache ? "Failed to update" : "Failed to load");
      console.error("[Displays] loadLive error:", err);
    }
  }

  // ===== Refresh link → Update in place (no reload) =====
  function wireRefresh(el) {
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      setStatus("Updating. Please wait");
      loadLive();
    });
  }
  wireRefresh(refreshLink);

  // Delegation ONLY for the Update link (do not match other links/classes)
  document.addEventListener("click", (e) => {
    const a = e.target.closest("#refreshLink");
    if (!a) return;
    e.preventDefault();
    setStatus("Updating. Please wait");
    loadLive();
  });

  // First live fetch
  loadLive();

  // Default open AM
  activate(tabAm);
})();
