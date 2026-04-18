/* ft.js — FT Contacts page
   - left slide-in year menu (kebab)
   - WhatsApp icon beside phone
   - sticky lilac header like full-attend
   - non-flashing loading indicator (animated dots only)
   - default WhatsApp message (optional, user-toggled, cached)
   - expects GAS to return { ok:true, rows:[ {class, ftCode, ftName, ftPhone, asstCode, asstName, asstPhone} ] }
*/

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // ===== ROLE ALLOW-LIST: only ADMIN, REGIS, CODER =====
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED = ["ADMIN", "REGIS", "CODER"];

  if (!ALLOWED.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return;
  }

  const WEBAPP_URL = "/.netlify/functions/ft-contacts"; // Netlify proxy -> GAS doGet
  const DEFAULT_YEAR = "7";

  // key to remember WA toggle choice
  const WA_TOGGLE_KEY = "ftWaDefaultOn";

  // ===== DOM lookups =====
  const $ = (s, root = document) => root.querySelector(s);

  const grid       = $("#grid");
  const subhead    = $("#subhead");
  const overlay    = $("#overlay");
  const overlayDim = $("#overlayDim");
  const kebabBtn   = $("#kebabBtn");
  const kebabClose = $("#kebabClose");
  const gridError  = $("#gridError");

  // loading message pieces
  const loadingBox  = $("#loadingMsg");
  const loadingText = $("#loadingText");
  const dotsSpan    = $("#dots");

  // WA default message toggle
  const waToggle = $("#waToggle");

  // internal state for WA default
  let useDefaultWa = false;

  // internal timer for dots animation
  let dotsTimer = null;

  function startDots() {
    stopDots();
    if (!dotsSpan) return;

    let count = 1;
    dotsSpan.textContent = ".";
    dotsTimer = setInterval(() => {
      count += 1;
      if (count > 3) count = 1;
      dotsSpan.textContent = ".".repeat(count);
    }, 500);
  }

  function stopDots() {
    if (dotsTimer) {
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
  }

  // ===== overlay open/close (use hidden attribute reliably) =====
  function openOverlay() {
    if (!overlay) return;
    overlay.removeAttribute("hidden");
  }
  function closeOverlay() {
    if (!overlay) return;
    overlay.setAttribute("hidden", "");
  }

  kebabBtn?.addEventListener("click", openOverlay);
  kebabClose?.addEventListener("click", closeOverlay);
  overlayDim?.addEventListener("click", closeOverlay);

  // ===== WA toggle persistence =====
  function loadWaPref() {
    try {
      const val = localStorage.getItem(WA_TOGGLE_KEY);
      useDefaultWa = (val === "1");
    } catch {
      useDefaultWa = false;
    }
    if (waToggle) waToggle.checked = useDefaultWa;
  }

  function saveWaPref(on) {
    useDefaultWa = !!on;
    try {
      localStorage.setItem(WA_TOGGLE_KEY, useDefaultWa ? "1" : "0");
    } catch {
      // ignore
    }
  }

  // If user toggles, refresh the table so WA links update immediately
  waToggle?.addEventListener("change", () => {
    saveWaPref(waToggle.checked);

    // Rebuild WA links without refetching if possible
    // (simple approach: reload current year)
    const y = (subhead?.textContent || "").match(/\d+/)?.[0] || DEFAULT_YEAR;
    loadYear(y);
  });

  // ===== helper: build WA link (with optional default message) =====
  function buildWaLink(num, code) {
    const clean = String(num || "").replace(/\D+/g, "");
    if (!clean) return "";

    let url = `https://wa.me/673${clean}`;

    if (useDefaultWa && code) {
      const msg =
        `Salam/Greetings Ckg ${code},\n\n` +
        `Please check your class attendance and verify it with a tick.\n\n` +
        `Thank you. 🙂`;
      url += `?text=${encodeURIComponent(msg)}`;
    }
    return url;
  }

  // ===== helper: render phone cell with WhatsApp icon =====
  function renderPhone(num, code) {
    const v = String(num || "").trim();
    if (!v) return "";

    const waUrl = buildWaLink(v, code);
    const safeNum = escapeHtml(v);

    return `
      <div class="phoneCell">
        <a href="${waUrl}" target="_blank" rel="noopener" title="Chat on WhatsApp">
          <img src="/shared/icons/whatsapp.svg" alt="WhatsApp" class="whatsapp-icon"/>
        </a>
        <span class="phone-num">${safeNum}</span>
      </div>
    `;
  }

  // ===== small safety: escape html for names/codes =====
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ===== renderTable(rows) =====
  function renderTable(rows) {
    const thead = `
      <thead>
        <tr>
          <th>Class</th>
          <th>FT Code</th>
          <th>FT Name</th>
          <th>FT Phone</th>
          <th>AFT Code</th>
          <th>AFT Name</th>
          <th>AFT Phone</th>
        </tr>
      </thead>
    `;

    let tbody = "<tbody>";
    for (const r of rows) {
      tbody += `
        <tr>
          <td>${escapeHtml(r.class ?? "")}</td>
          <td>${escapeHtml(r.ftCode ?? "")}</td>
          <td>${escapeHtml(r.ftName ?? "")}</td>
          <td>${renderPhone(r.ftPhone, r.ftCode)}</td>
          <td>${escapeHtml(r.asstCode ?? "")}</td>
          <td>${escapeHtml(r.asstName ?? "")}</td>
          <td>${renderPhone(r.asstPhone, r.asstCode)}</td>
        </tr>
      `;
    }
    tbody += "</tbody>";

    if (grid) grid.innerHTML = thead + tbody;
  }

  // ===== robust json parse =====
  async function readJsonFlexible(res) {
    // Try JSON first
    try {
      return await res.json();
    } catch {
      // Fallback: read text and extract last {...} block
      const txt = await res.text();
      const m = txt.match(/\{[\s\S]*\}\s*$/);
      if (!m) return null;
      try { return JSON.parse(m[0]); } catch { return null; }
    }
  }

  // ===== loadYear(y) =====
  async function loadYear(y) {
    const year = String(y || "").trim() || DEFAULT_YEAR;

    // show loading
    if (loadingBox && loadingText && dotsSpan) {
      loadingBox.hidden = false;
      loadingText.textContent = `Loading Year ${year}`;
      dotsSpan.textContent = ".";
      startDots();
    }

    // clear
    if (grid) grid.innerHTML = "";
    if (gridError) {
      gridError.hidden = true;
      gridError.textContent = "";
    }

    try {
      const res = await fetch(`${WEBAPP_URL}?year=${encodeURIComponent(year)}`, {
        cache: "no-cache",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await readJsonFlexible(res);

      if (!data || data.ok !== true || !Array.isArray(data.rows)) {
        throw new Error("Server returned invalid data");
      }

      renderTable(data.rows);

      if (subhead) subhead.textContent = `Year ${year}`;
    } catch (err) {
      console.error(err);

      if (gridError) {
        gridError.hidden = false;
        gridError.textContent = "Failed to load data";
      }

      if (grid) {
        grid.innerHTML = `
          <thead><tr><th>Error</th></tr></thead>
          <tbody><tr><td>${escapeHtml(err?.message || String(err))}</td></tr></tbody>
        `;
      }
    } finally {
      stopDots();
      if (loadingBox) loadingBox.hidden = true;
    }
  }

  // ===== year buttons in side panel (FIXED SELECTOR) =====
  // HTML uses: <button class="panel-item" data-level="8">Year 8</button>
  document.querySelectorAll(".panel-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const y = btn.dataset.level;
      closeOverlay();
      loadYear(y);
    });
  });

  // ===== init =====
  loadWaPref();

  if (subhead) subhead.textContent = `Year ${DEFAULT_YEAR}`;
  loadYear(DEFAULT_YEAR);
})();
