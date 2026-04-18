/* ft.js — FT Contacts page
   - left slide-in year menu (kebab)
   - WhatsApp icon beside phone
   - sticky lilac header like full-attend
   - non-flashing loading indicator (animated dots only)
   - default WhatsApp message (optional, user-toggled, cached)
   - expects GAS to return { ok:true, rows:[ {class, ftCode, ftName, ftPhone, asstCode, asstName, asstPhone} ] }
*/

// ===== LOCK to signed in user only =====
(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // ===== ROLE ALLOW-LIST: only ADMIN, REGIS, CODER =====
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED = ["ADMIN", "REGIS", "CODER","WELFARE"];

  if (!ALLOWED.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return; // stop everything else
  }

  const WEBAPP_URL = "/.netlify/functions/ft-contacts"; // Netlify proxy -> GAS doGet
  const DEFAULT_YEAR = "7";

  // key to remember WA toggle choice
  const WA_TOGGLE_KEY = "ftWaDefaultOn";

  // ===== DOM lookups =====
  const $ = (s, root=document) => root.querySelector(s);

  const grid        = $("#grid");        // <table id="grid" class="grid"></table>
  const subhead     = $("#subhead");     // "Year 7"
  const overlay     = $("#overlay");     // overlay wrapper
  const overlayDim  = $("#overlayDim");  // dark dim area
  const kebabBtn    = $("#kebabBtn");    // ⋮ in header
  const kebabClose  = $("#kebabClose");  // ✕ in panel
  const levelBtns   = document.querySelectorAll(".levelBtn"); // year buttons
  const gridError   = $("#gridError");   // optional error div (may not exist)

  // loading message pieces (outside card)
  const loadingBox   = $("#loadingMsg");
  const loadingText  = $("#loadingText");
  const dotsSpan     = $("#dots");

  // WA default message toggle
  const waToggle     = $("#waToggle");

  // internal state for WA default
  let useDefaultWa = false;

  // internal timer for dots animation
  let dotsTimer = null;

  function startDots(){
    stopDots();
    if (!dotsSpan) return;
    let count = 1;
    dotsTimer = setInterval(() => {
      count = count + 1;
      if (count > 3) count = 1;
      dotsSpan.textContent = ".".repeat(count);
    }, 500); // gentle, no flash, just text changes
  }
  function stopDots(){
    if (dotsTimer){
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
  }

  // ===== WA toggle persistence =====
  function loadWaPref(){
    try {
      const val = localStorage.getItem(WA_TOGGLE_KEY);
      useDefaultWa = (val === "1");
    } catch (e) {
      useDefaultWa = false;
    }
    if (waToggle) {
      waToggle.checked = useDefaultWa;
    }
  }

  function saveWaPref(on){
    useDefaultWa = !!on;
    try {
      localStorage.setItem(WA_TOGGLE_KEY, useDefaultWa ? "1" : "0");
    } catch (e) {
      // ignore storage errors
    }
  }

  // ===== helper: build WA link (with optional default message) =====
  function buildWaLink(num, code){
    const clean = String(num).replace(/\D+/g,"");
    let url = `https://wa.me/673${clean}`;

    if (useDefaultWa && code){
      const msg = `Salam/Greetings Ckg ${code},\n\nPlease check your class attendance and verify it with a tick.\n\nThank you. 🙂`;
      url += `?text=${encodeURIComponent(msg)}`;
    }

    return url;
  }

  // ===== helper: render phone cell with WhatsApp icon =====
  function renderPhone(num, code){
    if (!num || String(num).trim() === "") return "";
    const waUrl = buildWaLink(num, code);

    return `
      <a href="${waUrl}" target="_blank" title="Chat on WhatsApp">
        <img src="/shared/icons/whatsapp.svg" alt="WhatsApp" class="whatsapp-icon"/>
      </a>
      <span class="phone-num">${num}</span>
    `;
  }

  // ===== renderTable(rows) =====
  // rows is [{ class, ftCode, ftName, ftPhone, asstCode, asstName, asstPhone }, ...]
  function renderTable(rows){
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
    for (const r of rows){
      tbody += `
        <tr>
          <td>${r.class     ?? ""}</td>
          <td>${r.ftCode    ?? ""}</td>
          <td>${r.ftName    ?? ""}</td>
          <td>${renderPhone(r.ftPhone, r.ftCode)}</td>
          <td>${r.asstCode  ?? ""}</td>
          <td>${r.asstName  ?? ""}</td>
          <td>${renderPhone(r.asstPhone, r.asstCode)}</td>
        </tr>
      `;
    }
    tbody += "</tbody>";

    grid.innerHTML = thead + tbody;
  }

  // ===== loadYear(y) =====
  async function loadYear(y){
    // 1. Show loading message below the subhead, outside the card
    if (loadingBox && loadingText && dotsSpan){
      loadingBox.hidden = false;
      loadingText.textContent = `Loading Year ${y}`;
      dotsSpan.textContent = ".";
      startDots();
    }

    // 2. Clear the table while loading
    grid.innerHTML = "";

    try {
      // Fetch from Netlify proxy -> GAS
      const res = await fetch(`${WEBAPP_URL}?year=${encodeURIComponent(y)}`, {
        cache: "no-cache"
      });

      let data;
      try {
        // normal case: JSON response
        data = await res.json();
      } catch {
        // fallback if GAS returns HTML-wrapped JSON
        const txt = await res.text();
        const m = txt.match(/\{[\s\S]*\}$/);
        data = m ? JSON.parse(m[0]) : null;
      }

      if (!data || data.ok !== true || !Array.isArray(data.rows)) {
        throw new Error("Server returned invalid data");
      }

      // build table
      renderTable(data.rows);

      // update "Year X" label under title
      if (subhead) subhead.textContent = `Year ${y}`;

      // hide any previous error message
      if (gridError) {
        gridError.hidden = true;
      }

    } catch (err){
      console.error(err);

      // if you have an error box in HTML you can show it
      if (gridError){
        gridError.hidden = false;
        gridError.textContent = "Failed to load data";
      }

      // show fallback in the table itself too
      grid.innerHTML = `
        <thead>
          <tr><th>Error</th></tr>
        </thead>
        <tbody>
          <tr><td>${err.message || String(err)}</td></tr>
        </tbody>
      `;
    } finally {
      // 3. Hide loading message and stop dots
      stopDots();
      if (loadingBox){
        loadingBox.hidden = true;
      }
    }
  }

  // ===== overlay open/close logic =====
  kebabBtn?.addEventListener("click", () => {
    overlay.hidden = false;
  });

  kebabClose?.addEventListener("click", () => {
    overlay.hidden = true;
  });

  overlayDim?.addEventListener("click", () => {
    overlay.hidden = true;
  });

  // ===== year change buttons in the side panel =====
  levelBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const y = btn.dataset.level;
      overlay.hidden = true;
      loadYear(y);
    });
  });

  // ===== WA toggle change =====
  if (waToggle){
    waToggle.addEventListener("change", () => {
      saveWaPref(waToggle.checked);
    });
  }

  // ===== init =====
  loadWaPref();

  if (subhead) subhead.textContent = `Year ${DEFAULT_YEAR}`;
  if (loadingBox && loadingText && dotsSpan){
    loadingBox.hidden = false;
    loadingText.textContent = `Loading Year ${DEFAULT_YEAR}`;
    dotsSpan.textContent = ".";
    startDots();
  }
  loadYear(DEFAULT_YEAR);
})();
