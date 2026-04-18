/* /shared/attendance/autocopy/autocopy.js
 * Page:
 * - Header: kebab left, title center, closeBtn right -> reports.html
 * - Shows description + 2 tables from AUTOCOPY sheet ranges
 *
 * Gates:
 * 1) Only REGIS and CODER can enter
 * 2) If role REGIS: must have REPORTS BTN!C6 == 1 (server-checked)
 * 3) CODER always enter
 */

(function () {
  "use strict";

  const CLOSE_URL = "/shared/attendance/reports/reports.html";
  const API = "/.netlify/functions/autocopy"; // Netlify proxy -> GAS

  function norm(x){ return String(x || "").toUpperCase().trim(); }

  async function getWho() {
    if (!window.Auth || typeof Auth.waitWho !== "function") return null;
    return await Auth.waitWho(1400, 80);
  }

  function redirectHomeOrRole(role){
    const r = norm(role);
    if (window.Auth && typeof Auth.routeFor === "function" && r) {
      location.replace(Auth.routeFor(r) || "/");
    } else {
      location.replace("/");
    }
  }

  function setCloseBtn(){
    const btn = document.getElementById("closeBtn");
    if (!btn) return;
    btn.addEventListener("click", () => location.href = CLOSE_URL);
  }

  function renderTable(tableEl, grid, opts){
    if (!tableEl) return;
    tableEl.innerHTML = "";

    const rows = Array.isArray(grid) ? grid : [];
    const frag = document.createDocumentFragment();

    rows.forEach((row, rIdx) => {
      const tr = document.createElement("tr");

      if (rIdx === 0) tr.classList.add("rowHead");
      if (rIdx === rows.length - 1) tr.classList.add("rowBottom");

      (row || []).forEach((cell, cIdx) => {
        const td = document.createElement("td");
        td.textContent = cell == null ? "" : String(cell);

        // “Range in A2:A12” or “H2:H12” => first column rows 2..12 => rIdx 1..11, cIdx 0
        if (cIdx === 0 && rIdx >= 1 && rIdx <= 11) td.classList.add("firstCol");

        tr.appendChild(td);
      });

      frag.appendChild(tr);
    });

    tableEl.appendChild(frag);
  }

  async function apiGetPageData(){
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ mode: "getPageData" })
    });

    if (!res.ok) throw new Error("API network " + res.status);
    const json = await res.json();
    if (!json || !json.ok) throw new Error((json && json.error) || "API error");
    return json;
  }

  async function main(){
    setCloseBtn();

    // init kebab menu behavior
    if (window.LeftKebab && typeof LeftKebab.init === "function") {
      LeftKebab.init();
    }

    const who = await getWho();
    if (!who) { location.replace("/"); return; }

    const role = norm(who.role);
    const ALLOW = ["REGIS", "CODER"];
    if (!ALLOW.includes(role)) {
      redirectHomeOrRole(role);
      return;
    }

    // Gate REGIS via server cell C6
    if (role === "REGIS") {
      try{
        const data = await apiGetPageData();
        if (!data.regisEnabled) {
          location.replace(CLOSE_URL);
          return;
        }

        // Render tables
        const t1 = data.tables && data.tables.autocopy;
        const t2 = data.tables && data.tables.backupReset;

        renderTable(document.getElementById("tblAutocopy"), t1);
        renderTable(document.getElementById("tblBackup"), t2);

      }catch(err){
        console.error("[autocopy] gate/data failed:", err);
        location.replace(CLOSE_URL);
      }
      return;
    }

    // CODER: always allowed, still load data
    try{
      const data = await apiGetPageData();

      const t1 = data.tables && data.tables.autocopy;
      const t2 = data.tables && data.tables.backupReset;

      renderTable(document.getElementById("tblAutocopy"), t1);
      renderTable(document.getElementById("tblBackup"), t2);
    }catch(err){
      console.error("[autocopy] data failed:", err);
      // CODER can stay even if API fails; just show empty tables
      renderTable(document.getElementById("tblAutocopy"), []);
      renderTable(document.getElementById("tblBackup"), []);
    }
  }

  main();
})();
