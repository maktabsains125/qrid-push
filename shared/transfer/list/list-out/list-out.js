/* list-out.js
   TRANS OUT viewer:
   - Fetches all rows from TRANS OUT via Netlify → Apps Script (list endpoint)
   - Level dropdown filters names
   - Selecting a name autofills details (name, ID, gender, to, from, date)
   - Attendance button fetches full-year attendance for that student
   - Renders 34-column table (1 month label + 23 dates + 10 calc cols)
   - X is counted as non-enrolled: total school days = valid dates - X
   - Download CSV exports the rendered table
*/

(function () {
  "use strict";

  // ===== LOCK to signed in user only (role-based) =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  const allowedRoles = new Set(["ADMIN", "REGIS", "WELFARE", "CODER"]);

  if (!who || !allowedRoles.has(String(who.role || "").toUpperCase())) {
    window.location.replace("/");
    return; // stop here
  }

  // ====== CONFIG ======
  const LIST_API_URL   = "/.netlify/functions/list-out";
  const ATTEND_API_URL = "/.netlify/functions/list-out";

  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV"];
  const DATE_COLS  = 23;
  const CALC_COLS  = 10;
  const TOTAL_COLS = 1 + DATE_COLS + CALC_COLS; // 34

  // ===== DOM LOOKUPS =====
  const levelSel   = document.getElementById("levelSelect");
  const nameSel    = document.getElementById("nameSelect");

  const nameInput  = document.getElementById("stuName"); // optional, may not exist
  const idInput    = document.getElementById("stuId");
  const genderM    = document.getElementById("genderM");
  const genderF    = document.getElementById("genderF");
  const toInput    = document.getElementById("toClass");
  const fromInput  = document.getElementById("fromClass");
  const dateInput  = document.getElementById("transferDate");

  const statusEl   = document.getElementById("status");
  const dotsSpan   = statusEl ? statusEl.querySelector(".status-dots") : null;
  const closeTop   = document.getElementById("closeTop");

  // Attendance card elements
  const attendBtn   = document.getElementById("attendBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const attStatus   = document.getElementById("attStatus");
  const tableWrap   = document.getElementById("tableWrap");
  const attTable    = document.getElementById("attTable");
  const attHead1    = document.getElementById("attHead1");
  const attHead2    = document.getElementById("attHead2");
  const attBody     = document.getElementById("attBody");

  // Kebab overlay
  const kebabBtn       = document.getElementById("kebabBtn");
  const kebabPanel     = document.getElementById("kebabPanel");
  const kebabDim       = document.getElementById("kebabDim");
  const panelCloseBtn  = document.getElementById("panelCloseBtn");
  const googleSh       = document.getElementById("googleSh");
  const closeBtn       = document.getElementById("closeBtn"); // may not exist

  // ===== STATE =====
  let rowsByLevel = {};   // { "Year 7": [row,row], ... }
  let currentList = [];   // rows for currently selected level
  let loadedStudent = null;
  let dotsTimer = null;

  // ===== STATUS HANDLER (QRID standard . → .. → ... dots) =====
  function startDots() {
    stopDots();
    if (!dotsSpan) return;

    const frames = [".", "..", "..."];
    let i = 0;
    dotsSpan.textContent = frames[0];

    dotsTimer = setInterval(() => {
      i = (i + 1) % frames.length;
      dotsSpan.textContent = frames[i];
    }, 700);
  }

  function stopDots() {
    if (dotsTimer) {
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
    if (dotsSpan) dotsSpan.textContent = "";
  }

  function setStatus(msg, isLoading) {
    if (!statusEl) return;
    const textSpan = statusEl.querySelector(".status-text");
    if (textSpan) textSpan.textContent = msg;
    if (isLoading) startDots();
    else stopDots();
  }

  // ===== CLEAR DETAIL FIELDS =====
  function valueIfExists(input, v) {
    if (input) input.value = v;
  }

  function clearAttendanceTable() {
    if (attHead1) attHead1.innerHTML = "";
    if (attHead2) attHead2.innerHTML = "";
    if (attBody)  attBody.innerHTML  = "";
    if (tableWrap) tableWrap.hidden = true;
    if (downloadBtn) downloadBtn.disabled = true;
    if (attStatus) {
      attStatus.textContent = "Select a student above and click Attendance to load their record.";
    }
    loadedStudent = null;
  }

  function clearDetails() {
    if (nameInput) nameInput.value = "";
    if (idInput) idInput.value = "";
    if (genderM) genderM.checked = false;
    if (genderF) genderF.checked = false;
    if (toInput) toInput.value = "";
    if (fromInput) fromInput.value = "";
    if (dateInput) valueIfExists(dateInput, "");
    clearAttendanceTable();
  }

  // ===== POPULATE NAME DROPDOWN =====
  function populateNames(levelLabel) {
    clearDetails();
    nameSel.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = levelLabel ? "Select a name" : "Select level first";
    nameSel.appendChild(placeholder);

    if (!levelLabel) {
      nameSel.disabled = true;
      return;
    }

    currentList = rowsByLevel[levelLabel] || [];

    if (!currentList.length) {
      nameSel.disabled = true;
      setStatus(`No records found for ${levelLabel}.`, false);
      return;
    }

    currentList.forEach((row, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = row.name || "";
      nameSel.appendChild(opt);
    });

    nameSel.disabled = false;
    setStatus(`Found ${currentList.length} record(s) for ${levelLabel}.`, false);
  }

  // ===== SHOW DETAILS FOR SELECTED NAME =====
  function showDetails(indexStr) {
    clearDetails();
    if (!indexStr) return;

    const idx = parseInt(indexStr, 10);
    const row = currentList[idx];
    if (!row) return;

    if (nameInput) nameInput.value = row.name || "";
    if (idInput)   idInput.value   = row.id || "";
    if (toInput)   toInput.value   = row.transferTo || "";
    if (fromInput) fromInput.value = row.transferFrom || "";
    if (dateInput) dateInput.value = row.date || "";

    if (row.gender === "M") {
      if (genderM) genderM.checked = true;
    } else if (row.gender === "F") {
      if (genderF) genderF.checked = true;
    }

    clearAttendanceTable();
  }

  // ===== FETCH ALL TRANS OUT ROWS =====
  async function fetchAllTransfers() {
    try {
      setStatus("Loading. Please wait", true);

      const res = await fetch(`${LIST_API_URL}?action=list`, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (!res.ok) throw new Error("Network response was not ok");

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Backend returned an error");

      rowsByLevel = (data.rows || []).reduce((acc, row) => {
        const levelLabel = row.levelLabel || row.level || "";
        if (!levelLabel) return acc;
        if (!acc[levelLabel]) acc[levelLabel] = [];
        acc[levelLabel].push(row);
        return acc;
      }, {});

      setStatus("Pick a level, then a name.", false);
      if (levelSel) levelSel.disabled = false;
    } catch (err) {
      console.error(err);
      setStatus("Error loading data. Please refresh.", false);
      if (levelSel) levelSel.disabled = true;
      if (nameSel) nameSel.disabled = true;
    }
  }

  // ===== ATTENDANCE FETCH + RENDER =====
  function onAttendanceClick() {
    const levelLabel = levelSel.value;
    const studentIdx = nameSel.value;
    const id = (idInput && idInput.value || "").trim();

    if (!levelLabel) {
      if (attStatus) attStatus.textContent = "Please select a level first.";
      return;
    }
    if (!studentIdx) {
      if (attStatus) attStatus.textContent = "Please select a student first.";
      return;
    }
    if (!id) {
      if (attStatus) attStatus.textContent = "Selected student has no ID.";
      return;
    }

    const idx = parseInt(studentIdx, 10);
    const row = currentList[idx];
    if (!row) {
      if (attStatus) attStatus.textContent = "Could not find that student record.";
      return;
    }

    const params = new URLSearchParams({
      action: "attendance",
      id: id,
      level: levelLabel
    });

    setStatus("Loading attendance. Please wait", true);
    if (attStatus) attStatus.textContent = "Loading attendance…";

    fetch(`${ATTEND_API_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    })
      .then(res => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then(json => {
        if (!json.ok) throw new Error(json.error || "Backend error");
        renderAttendanceTable(json);
        loadedStudent = {
          name: row.name || "",
          id: id,
          level: levelLabel,
          gender: row.gender || "",
          fromClass: row.transferFrom || "",
          toClass: row.transferTo || "",
          date: row.date || ""
        };
        setStatus("Attendance loaded.", false);
      })
      .catch(err => {
        console.error(err);
        clearAttendanceTable();
        setStatus("Error loading attendance.", false);
      });
  }

  function renderAttendanceTable(data) {
    if (!attHead1 || !attHead2 || !attBody || !tableWrap) return;

    attHead1.innerHTML = "";
    attHead2.innerHTML = "";
    attBody.innerHTML  = "";

    const calcLabels = [
      "Total M","Total P","Total N","Total L",
      "Abs from L/3","Monthly Abs","Monthly Attend",
      "% Monthly Attend","Cumulative","% Cumulative"
    ];

    const h1 = [];
    h1.push('<th class="stickyCol monthLabel">Month</th>');
    for (let c = 1; c <= DATE_COLS; c++) h1.push(`<th class="center">${c}</th>`);
    calcLabels.forEach(label => h1.push(`<th class="calcHead center">${escapeHtml(label)}</th>`));
    attHead1.innerHTML = h1.join("");

    const h2 = [];
    for (let c = 0; c < TOTAL_COLS; c++) h2.push(c === 0 ? '<th class="stickyCol"></th>' : "<th></th>");
    attHead2.innerHTML = h2.join("");

    let cumPresent = 0;
    let cumDays    = 0;

    MONTHS.forEach((mon, monIdx) => {
      const m = (data.months && data.months[mon]) || {};
      const dates = normalizeN(m.dates, DATE_COLS);
      const marks = normalizeN(m.marks, DATE_COLS);

      const validIdxs = [];
      for (let i = 0; i < DATE_COLS; i++) {
        if (String(dates[i] || "").trim()) validIdxs.push(i);
      }

      let present1 = 0, tM = 0, tP = 0, tN = 0, tL = 0, countX = 0;
      for (const i of validIdxs) {
        const s = (marks[i] == null ? "" : String(marks[i])).trim().toUpperCase();
        if (s === "1") present1++;
        else if (s === "M") tM++;
        else if (s === "P") tP++;
        else if (s === "N") tN++;
        else if (s === "L") tL++;
        else if (s === "X") countX++;
      }

      const rawDays     = validIdxs.length;
      const schoolDays  = Math.max(0, rawDays - countX);
      const absFromL3   = Math.floor((tL || 0) / 3);
      const monthlyPres = (tL + present1) - absFromL3;
      const monthlyAbs  = Math.max(0, schoolDays - monthlyPres);
      const pctMonthly  = pct(monthlyPres, schoolDays);

      cumPresent += monthlyPres;
      cumDays    += schoolDays;
      const pctCum = pct(cumPresent, cumDays);

      const rDates = [];
      rDates.push(`<td class="stickyCol monthLabel center">${escapeHtml(mon)}</td>`);
      for (let c = 0; c < DATE_COLS; c++) {
        rDates.push(`<td class="dateCell center">${escapeHtml(formatDayLabel(dates[c], monIdx + 1))}</td>`);
      }
      calcLabels.forEach(() => rDates.push('<td class="calcHead center"></td>'));
      attBody.insertAdjacentHTML("beforeend", `<tr>${rDates.join("")}</tr>`);

      const rMarks = [];
      rMarks.push('<td class="stickyCol monthLabel"></td>');
      for (let c = 0; c < DATE_COLS; c++) {
        const markVal = marks[c];
        rMarks.push(`<td class="center">${escapeHtml(markVal == null ? "" : String(markVal))}</td>`);
      }

      rMarks.push(tdCalc(tM));
      rMarks.push(tdCalc(tP));
      rMarks.push(tdCalc(tN));
      rMarks.push(tdCalc(tL));
      rMarks.push(tdCalc(absFromL3));
      rMarks.push(tdCalc(monthlyAbs));
      rMarks.push(tdCalc(monthlyPres));
      rMarks.push(tdCalcPct(pctMonthly));
      rMarks.push(tdCalc(cumPresent));
      rMarks.push(tdCalcPct(pctCum));

      attBody.insertAdjacentHTML("beforeend", `<tr>${rMarks.join("")}</tr>`);
    });

    tableWrap.hidden = false;
    if (downloadBtn) downloadBtn.disabled = false;
    if (attStatus) attStatus.textContent = "Attendance loaded. Scroll to view details or download as CSV.";
  }

  // ===== CSV EXPORT =====
  function onDownloadClick() {
    if (!attTable || !loadedStudent) return;

    const rows = [];

    const meta = [
      ["Name",   loadedStudent.name || ""],
      ["Level",  loadedStudent.level || ""],
      ["ID",     loadedStudent.id || ""],
      ["Gender", loadedStudent.gender || ""],
      ["From",   loadedStudent.fromClass || ""],
      ["To",     loadedStudent.toClass || ""],
      ["Transfer date", loadedStudent.date || ""],
      []
    ];

    meta.forEach(r => rows.push(r.map(csvEscape).join(",")));

    attTable.querySelectorAll("tr").forEach(tr => {
      const cells = Array.from(tr.children).map(td => csvEscape(td.textContent));
      rows.push(cells.join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safeName = (loadedStudent.name || "attendance").replace(/[^a-z0-9]+/gi, "_");
    a.download = `${safeName}_attendance.csv`;
    a.click();
  }

  // ===== Utils =====
  function normalizeN(arr, n) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = (arr && arr[i]) || "";
    return out;
  }

  function pct(num, den) {
    if (!den) return 0;
    return Math.round((num / den) * 10000) / 100;
  }

  function tdCalc(v) {
    const n = Number(v) || 0;
    return `<td class="calcCol center">${n}</td>`;
  }

  function tdCalcPct(v) {
    const n = Number(v) || 0;
    return `<td class="calcCol center">${n.toFixed(2)}%</td>`;
  }

  function formatDayLabel(dayValue, fallbackMonthNumber) {
    const asString = String(dayValue || "");

    if (dayValue instanceof Date || /^\d{4}-\d{2}-\d{2}T/.test(asString)) {
      const d = new Date(dayValue);
      if (isNaN(d)) return "";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}`;
    }

    const raw = asString.trim();
    if (!raw) return "";

    const m1 = raw.match(/^(\d{2})\/(\d{2})\/\d{4}$/);
    if (m1) return `${m1[1]}/${m1[2]}`;

    const m2 = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m2) return `${m2[1].padStart(2, "0")}/${m2[2].padStart(2, "0")}`;

    const n = Number(raw);
    if (!Number.isFinite(n)) return raw;

    const m = fallbackMonthNumber || 1;
    return `${String(n).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m =>
      m === "&" ? "&amp;" :
      m === "<" ? "&lt;"  :
      m === ">" ? "&gt;"  :
      m === '"' ? "&quot;" :
                  "&#39;"
    );
  }

  function csvEscape(val) {
    const s = String(val || "");
    return `"${s.replace(/"/g, '""')}"`;
  }

  // ===== INIT =====
  function init() {
    if (levelSel) levelSel.disabled = true;
    if (nameSel) nameSel.disabled = true;
    clearDetails();

    if (levelSel) {
      levelSel.addEventListener("change", () => {
        populateNames(levelSel.value);
        if (nameSel) nameSel.value = "";
      });
    }

    if (nameSel) {
      nameSel.addEventListener("change", () => {
        showDetails(nameSel.value);
      });
    }

    if (closeTop) {
      closeTop.addEventListener("click", () => window.history.back());
    }

    if (attendBtn) attendBtn.addEventListener("click", onAttendanceClick);
    if (downloadBtn) downloadBtn.addEventListener("click", onDownloadClick);

    // ===== Kebab overlay helpers =====
    function openMenu(){
      if (!kebabPanel) return;
      kebabPanel.hidden = false;
      kebabPanel.setAttribute("aria-hidden", "false");
    }
    function closeMenu(){
      if (!kebabPanel) return;
      kebabPanel.hidden = true;
      kebabPanel.setAttribute("aria-hidden", "true");
    }

    // ===== Kebab menu wiring =====
    if (kebabBtn) kebabBtn.addEventListener("click", openMenu);
    if (panelCloseBtn) panelCloseBtn.addEventListener("click", closeMenu);
    if (kebabDim) kebabDim.addEventListener("click", closeMenu);

    // Only link exists; close menu after clicking it (navigation continues)
    if (kebabPanel){
      kebabPanel.addEventListener("click", (e) => {
        const link = e.target.closest("a.panel-item");
        if (link) closeMenu();
      });
    }

    // Optional: if a closeBtn exists in this page
    if (closeBtn) closeBtn.addEventListener("click", () => window.history.back());

    fetchAllTransfers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();