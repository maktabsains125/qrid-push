/* regis.js — Registration Committee contacts
   - same visual language as FT contacts
   - no kebab/overlay
   - columns: Role | Code | Name | Phone
   - gentle loading dots (no flashing)
   - expects GAS to return:
     { ok:true, rows:[ { role, code, fullName, phone }, ... ] }
*/

// ===== LOCK to signed in user only =====
(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // ===== ROLE ALLOW-LIST: only REGIS, CODER, ADMIN =====
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED = ["REGIS", "CODER", "ADMIN"];

  if (!ALLOWED.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return; // stop everything else
  }

  // point this at your Netlify proxy for the new REGIS Apps Script
  const WEBAPP_URL = "/.netlify/functions/regis-contacts";

  // ===== DOM helpers / lookups =====
  const $ = (s, root=document) => root.querySelector(s);

  const grid        = $("#grid");        // <table id="grid">
  const gridError   = $("#gridError");   // error div in .tableWrap
  const loadingBox  = $("#loadingMsg");  // whole "Loading..." line
  const loadingText = $("#loadingText"); // "Loading committee"
  const dotsSpan    = $("#dots");        // animated dots

  // ===== loading dots (non-flashing, just "." ".." "...") =====
  let dotsTimer = null;
  function startDots(){
    stopDots();
    if (!dotsSpan) return;
    let count = 1;
    dotsTimer = setInterval(() => {
      count++;
      if (count > 3) count = 1;
      dotsSpan.textContent = ".".repeat(count);
    }, 500);
  }
  function stopDots(){
    if (dotsTimer){
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
  }

  // ===== helper to render phone w/ WhatsApp icon =====
  function renderPhone(num){
    if (!num || String(num).trim() === "") return "";
    const clean = String(num).replace(/\D+/g,""); // remove spaces, dashes, etc.

    return `
      <a href="https://wa.me/673${clean}" target="_blank" title="Chat on WhatsApp">
        <img src="/shared/icons/whatsapp.svg" alt="WhatsApp" class="whatsapp-icon"/>
      </a>
      <span class="phone-num">${num}</span>
    `;
  }

  // ===== renderTable(rows) =====
  // rows: [{ role, code, fullName, phone }, ...]
  function renderTable(rows){
    const thead = `
      <thead>
        <tr>
          <th>Role</th>
          <th>Code</th>
          <th>Name</th>
          <th>Phone</th>
        </tr>
      </thead>
    `;

    let tbody = "<tbody>";
    for (const r of rows){
      tbody += `
        <tr>
          <td>${r.role      ?? ""}</td>
          <td>${r.code      ?? ""}</td>
          <td>${r.fullName  ?? ""}</td>
          <td>${renderPhone(r.phone)}</td>
        </tr>
      `;
    }
    tbody += "</tbody>";

    grid.innerHTML = thead + tbody;
  }

  // ===== loadOnce() =====
  async function loadOnce(){
    // show loading line
    if (loadingBox && loadingText && dotsSpan){
      loadingBox.hidden = false;
      loadingText.textContent = "Loading committee";
      dotsSpan.textContent = ".";
      startDots();
    }

    // clear table
    grid.innerHTML = "";

    try {
      const res = await fetch(WEBAPP_URL, { cache:"no-cache" });

      let data;
      try {
        data = await res.json();
      } catch {
        // fallback if GAS wrapped in HTML
        const txt = await res.text();
        const m = txt.match(/\{[\s\S]*\}$/);
        data = m ? JSON.parse(m[0]) : null;
      }

      if (!data || data.ok !== true || !Array.isArray(data.rows)){
        throw new Error("Server returned invalid data");
      }

      renderTable(data.rows);

      // hide old error
      if (gridError){
        gridError.hidden = true;
      }

    } catch (err){
      console.error(err);

      // show nice inline error box
      if (gridError){
        gridError.hidden = false;
        gridError.textContent = "Failed to load data";
      }

      // also render fallback row
      grid.innerHTML = `
        <thead>
          <tr><th>Error</th></tr>
        </thead>
        <tbody>
          <tr><td>${err.message || String(err)}</td></tr>
        </tbody>
      `;
    } finally {
      // stop loading
      stopDots();
      if (loadingBox){
        loadingBox.hidden = true;
      }
    }
  }

  // ===== first load immediately =====
  loadOnce();
})();
