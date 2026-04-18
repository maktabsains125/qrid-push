/* all.js — All Teachers Contacts
   - Similar UI to regis and ft
   - Columns: USER | FULL NAME | PHONE | SESSION
   - No kebab or filters
*/

// ===== LOCK to signed in user only =====
(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // ===== ROLE ALLOW-LIST: only REGIS, ADMIN, CODER =====
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED = ["REGIS", "ADMIN", "CODER"];

  if (!ALLOWED.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return; // stop everything else
  }

  const WEBAPP_URL = "/.netlify/functions/all-contacts";

  const $ = (s, root = document) => root.querySelector(s);

  const grid        = $("#grid");
  const gridError   = $("#gridError");
  const loadingBox  = $("#loadingMsg");
  const loadingText = $("#loadingText");
  const dotsSpan    = $("#dots");

  // ===== Dots animation =====
  let dotsTimer = null;
  function startDots() {
    stopDots();
    if (!dotsSpan) return;
    let count = 1;
    dotsTimer = setInterval(() => {
      count++;
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

  // ===== WhatsApp renderer =====
  function renderPhone(num) {
    if (!num || String(num).trim() === "") return "";
    const clean = String(num).replace(/\D+/g, "");
    return `
      <a href="https://wa.me/673${clean}" target="_blank" title="Chat on WhatsApp">
        <img src="/shared/icons/whatsapp.svg" alt="WhatsApp" class="whatsapp-icon"/>
      </a>
      <span class="phone-num">${num}</span>
    `;
  }

  // ===== Table builder =====
  function renderTable(rows) {
    const thead = `
      <thead>
        <tr>
          <th>User</th>
          <th>Full Name</th>
          <th>Phone</th>
          <th>Session</th>
        </tr>
      </thead>`;
    let tbody = "<tbody>";
    for (const r of rows) {
      tbody += `
        <tr>
          <td>${r.user ?? ""}</td>
          <td>${r.fullName ?? ""}</td>
          <td>${renderPhone(r.phone)}</td>
          <td>${r.session ?? ""}</td>
        </tr>`;
    }
    tbody += "</tbody>";
    grid.innerHTML = thead + tbody;
  }

  // ===== Loader =====
  async function loadAll() {
    if (loadingBox && loadingText && dotsSpan) {
      loadingBox.hidden = false;
      loadingText.textContent = "Loading all teachers";
      dotsSpan.textContent = ".";
      startDots();
    }

    grid.innerHTML = "";
    try {
      const res = await fetch(WEBAPP_URL, { cache: "no-cache" });
      let data;
      try {
        data = await res.json();
      } catch {
        const txt = await res.text();
        const m = txt.match(/\{[\s\S]*\}$/);
        data = m ? JSON.parse(m[0]) : null;
      }

      if (!data || data.ok !== true || !Array.isArray(data.rows))
        throw new Error("Invalid data from server");

      renderTable(data.rows);
      if (gridError) gridError.hidden = true;
    } catch (err) {
      console.error(err);
      if (gridError) {
        gridError.hidden = false;
        gridError.textContent = "Failed to load data";
      }
      grid.innerHTML = `
        <thead><tr><th>Error</th></tr></thead>
        <tbody><tr><td>${err.message || String(err)}</td></tr></tbody>`;
    } finally {
      stopDots();
      if (loadingBox) loadingBox.hidden = true;
    }
  }

  // ===== Init =====
  loadAll();
})();
