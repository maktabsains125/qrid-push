/* /shared/attendance/individual/app.js
   - Individual student attendance view (Year grid → class → student)
   - Uses:
      X = non-enrolled day (excluded from schoolDays)
      1, L (with L/3 penalty) = present
      M, P, N counted in totals + days, not present
*/

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // ===== ROLE GATE (tweak if needed) =====
  const role = String(who.role || "").toUpperCase().trim();
  const BLOCKED = ["FT", "GENERAL", ""];
  if (BLOCKED.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return;
  }

  // ===== CONFIG =====
  const ENDPOINT = "/.netlify/functions/individual";
  const SPREADSHEET_ID = "1FcCiq4Zx1ec8oD38BGKyB4fP8te-MioniO4FV5QNauw";
  const VALID_LEVELS = new Set(["7", "8", "9", "10", "12", "13"]);

  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV"];
  const DATE_COLS = 23;
  const CALC_COLS = 10;
  const TOTAL_COLS = 1 + DATE_COLS + CALC_COLS; // Month + dates + calc

  // ===== DOM =====
  const $ = (s, r = document) => r.querySelector(s);

  const gridView    = $("#gridView");
  const yearView    = $("#yearView");
  const pageTitle   = $("#pageTitle");
  const yearHeading = $("#yearHeading");
  const closeBtn    = $("#closeBtn");

  const classSel    = $("#classSel");
  const nameSel     = $("#nameSel");
  const idField     = $("#idField");
  const genderField = $("#genderField");

  const headerRow1 = $("#headerRow1");
  const headerRow2 = $("#headerRow2");
  const attBody    = $("#attBody");
  const tableWrap  = document.querySelector(".tableWrap");
  const statusMsg  = $("#statusMsg");
  const attTable   = $("#attTable");

  // ===== CACHE =====
  const cache = new Map();

  // ===== INIT =====
  init();

  function init() {
// Close button
if (closeBtn) {
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();

    // live role first, then localStorage fallback
    const roleFromAuth =
      (window.Auth && typeof Auth.who === "function" && Auth.who()?.role) || "";
    const roleFromLS = localStorage.getItem("ms_role") || "";
    const r = String(roleFromAuth || roleFromLS).toUpperCase().trim();

    // If HEP -> go to their dashboard
    if (r === "HEP") {
      const hepDash =
        (window.Auth && typeof Auth.routeFor === "function")
          ? (Auth.routeFor("HEP") || "/roles/hep")
          : "/roles/hep";

      location.replace(hepDash);
      return;
    }

    // default behaviour (your original)
    location.href = "/shared/attendance/index.html";
  });
}



    // Router: grid vs year view
    const params = new URLSearchParams(location.search);
    const levelParam = (params.get("level") || "").trim();

    if (VALID_LEVELS.has(levelParam)) {
      goYear(levelParam);
    } else {
      goGrid();
    }

    // Click on Year buttons in gridView
    gridView?.addEventListener("click", (e) => {
      const a = e.target.closest(".peachBtn");
      if (!a) return;
      const lv = String(a.dataset.level || "");
      if (VALID_LEVELS.has(lv)) {
        // navigate with ?level=...
        location.href = `?level=${encodeURIComponent(lv)}`;
      }
    });
  }

  // ===== DASHBOARD RETURN (shared pattern) =====
  function goBackToRole() {
    // Prefer live session role
    const roleFromAuth =
      (window.Auth &&
       typeof Auth.who === "function" &&
       Auth.who()?.role) || "";
    // Fallback to stored role (like other pages)
    const roleFromLS = localStorage.getItem("ms_role") || "";

    const r = String(roleFromAuth || roleFromLS).toUpperCase().trim();

    const dest =
      (window.Auth &&
       typeof Auth.routeFor === "function" &&
       r)
        ? Auth.routeFor(r)
        : (r ? `/roles/${r.toLowerCase()}` : "/");

    // Direct replace → no intermediate page flash
    location.replace(dest);
  }

  function goGrid() {
    pageTitle.textContent = "INDIVIDUAL ATTENDANCE";
    gridView.hidden = false;
    yearView.hidden = true;
  }

  function goYear(level) {
    pageTitle.textContent = "Individual Attendance";
    yearHeading.textContent = `Year ${level} Individual Attendance`;
    gridView.hidden = true;
    yearView.hidden = false;

    loadLevel(level);
  }

  // ===== LEVEL LOAD (bootstrap) =====
  async function loadLevel(level) {
    setStatus("Loading classes…");
    clearForm();
    clearTable();

    try {
      const boot = await getBootstrap(level);
      fillClassSelect(boot.classes || []);
      classSel.onchange = () => onClassChange(level);
      nameSel.onchange  = () => onNameChange(level);
      setStatus("Select a class, then a student.");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  async function getBootstrap(level) {
    const key = `boot.${level}`;
    if (cache.has(key)) return cache.get(key);

    const url = `${ENDPOINT}?sheet=${encodeURIComponent(level)}&mode=bootstrap&id=${encodeURIComponent(
      SPREADSHEET_ID
    )}`;
    const json = await fetchJson(url);
    if (json.error) throw new Error(json.error);

    cache.set(key, json);
    return json;
  }

  function fillClassSelect(classes) {
    const list = Array.isArray(classes) ? classes.filter(Boolean) : [];
    const opts = ['<option value="" disabled selected>Select class…</option>']
      .concat(list.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`));
    classSel.innerHTML = opts.join("");
    classSel.disabled = list.length === 0;

    nameSel.innerHTML = '<option value="" disabled selected>Select name…</option>';
    nameSel.disabled = true;
  }

  // ===== CLASS CHANGE =====
  async function onClassChange(level) {
    const cls = classSel.value;
    idField.value = "";
    genderField.value = "";
    clearTable();

    if (!cls) {
      nameSel.innerHTML = '<option value="" disabled selected>Select name…</option>';
      nameSel.disabled = true;
      return;
    }

    try {
      setStatus("Loading students…");
      const list = await getRoster(level, cls);
      const opts = ['<option value="" disabled selected>Select name…</option>']
        .concat(
          list.map(s =>
            `<option value="${escapeHtml(s.id)}" data-g="${escapeHtml(s.gender || "")}">
               ${escapeHtml(s.name)}
             </option>`
          )
        );
      nameSel.innerHTML = opts.join("");
      nameSel.disabled = list.length === 0;
      setStatus("Select a student.");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  async function getRoster(level, cls) {
    const key = `roster.${level}.${cls}`;
    if (cache.has(key)) return cache.get(key);

    const url = `${ENDPOINT}?sheet=${encodeURIComponent(level)}&mode=roster&class=${encodeURIComponent(
      cls
    )}&id=${encodeURIComponent(SPREADSHEET_ID)}`;
    const json = await fetchJson(url);
    if (json.error) throw new Error(json.error);

    const list = Array.isArray(json.students) ? json.students : [];
    cache.set(key, list);
    return list;
  }

  // ===== STUDENT CHANGE =====
  async function onNameChange(level) {
    const id = nameSel.value;
    if (!id) {
      clearForm();
      clearTable();
      return;
    }

    try {
      setStatus("Loading attendance record…");
      const rec = await getStudent(level, id);

      idField.value     = String(rec.id || "");
      genderField.value = String(rec.gender || "");

      renderStudentTable(rec);

      setStatus("Attendance loaded. Scroll inside the table to view.");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  async function getStudent(level, id) {
    const key = `student.${level}.${id}`;
    if (cache.has(key)) return cache.get(key);

    const url = `${ENDPOINT}?sheet=${encodeURIComponent(level)}&mode=student&sid=${encodeURIComponent(
      id
    )}&id=${encodeURIComponent(SPREADSHEET_ID)}`;
    const json = await fetchJson(url);
    if (json.error) throw new Error(json.error);

    cache.set(key, json);
    return json;
  }

  // ===== TABLE RENDER =====
  function renderStudentTable(data) {
    if (!headerRow1 || !headerRow2 || !attBody || !tableWrap) return;

    headerRow1.innerHTML = "";
    headerRow2.innerHTML = "";
    attBody.innerHTML    = "";

    const months = MONTHS;

    // Header row 1: Month | 1..23 | calc labels
    const calcLabels = [
      "Total M","Total P","Total N","Total L",
      "Abs from L/3","Monthly Abs","Monthly Attend",
      "% Monthly Attend","Cumulative","% Cumulative"
    ];

    const h1 = [];
    h1.push('<th class="stickyCol monthLabel">Month</th>');
    for (let c = 1; c <= DATE_COLS; c++) {
      h1.push(`<th class="center">${c}</th>`);
    }
    calcLabels.forEach(label => {
      h1.push(`<th class="calcHead center">${escapeHtml(label)}</th>`);
    });
    headerRow1.innerHTML = h1.join("");

    // Header row 2: empty, keeps structure
    const h2 = [];
    for (let c = 0; c < TOTAL_COLS; c++) {
      if (c === 0) {
        h2.push('<th class="stickyCol"></th>');
      } else {
        h2.push("<th></th>");
      }
    }
    headerRow2.innerHTML = h2.join("");

    // Body rows: per month, 2 rows each
    let cumPresent = 0;
    let cumDays    = 0;

    months.forEach((mon, monIdx) => {
      const m = (data.months && data.months[mon]) || {};
      const dates = normalizeN(m.dates, DATE_COLS);
      const marks = normalizeN(m.marks, DATE_COLS);

      // Compute stats
      const validIdxs = [];
      for (let i = 0; i < DATE_COLS; i++) {
        if (String(dates[i] || "").trim()) validIdxs.push(i);
      }

      let present1 = 0, tM = 0, tP = 0, tN = 0, tL = 0, countX = 0;
      for (const i of validIdxs) {
        const rawMark = marks[i];
        const s = rawMark == null ? "" : String(rawMark).trim().toUpperCase();

        if (s === "1") present1++;
        else if (s === "M") tM++;
        else if (s === "P") tP++;
        else if (s === "N") tN++;
        else if (s === "L") tL++;
        else if (s === "X") countX++;
        // "0" (and others) → just a day, not present; contributes to absence indirectly
      }

      const rawDays     = validIdxs.length;
      const schoolDays  = Math.max(0, rawDays - countX); // exclude X
      const absFromL3   = Math.floor((tL || 0) / 3);
      const monthlyPres = (tL + present1) - absFromL3;
      const monthlyAbs  = Math.max(0, schoolDays - monthlyPres);
      const pctMonthly  = pct(monthlyPres, schoolDays);

      cumPresent += monthlyPres;
      cumDays    += schoolDays;
      const pctCum = pct(cumPresent, cumDays);

      // Dates row
      const rDates = [];
      rDates.push(`<td class="stickyCol monthLabel center">${escapeHtml(mon)}</td>`);
      for (let c = 0; c < DATE_COLS; c++) {
        rDates.push(
          `<td class="dateCell center">${escapeHtml(
            formatDayLabel(dates[c], monIdx + 1)
          )}</td>`
        );
      }
      calcLabels.forEach(() => {
        rDates.push('<td class="calcHead center"></td>');
      });
      attBody.insertAdjacentHTML("beforeend", `<tr>${rDates.join("")}</tr>`);

      // Marks row
      const rMarks = [];
      rMarks.push('<td class="stickyCol monthLabel"></td>');
      for (let c = 0; c < DATE_COLS; c++) {
        const markVal = marks[c];
        rMarks.push(
          `<td class="center">${escapeHtml(markVal == null ? "" : String(markVal))}</td>`
        );
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

    if (tableWrap) tableWrap.hidden = false;
  }

  // ===== UTIL FUNCS =====
  function clearForm() {
    nameSel.value = "";
    nameSel.disabled = true;
    idField.value = "";
    genderField.value = "";
  }

  function clearTable() {
    headerRow1.innerHTML = "";
    headerRow2.innerHTML = "";
    attBody.innerHTML    = "";
  }

  function setStatus(msg) {
    if (statusMsg) statusMsg.textContent = msg || "";
  }

  function normalizeN(arr, n) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = (arr && arr[i]) || "";
    }
    return out;
  }

  function pct(num, den) {
    if (!den) return 0;
    return Math.round((num / den) * 10000) / 100; // 2 dp
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

    // Date object or ISO string
    if (dayValue instanceof Date || /^\d{4}-\d{2}-\d{2}T/.test(asString)) {
      const d = new Date(dayValue);
      if (isNaN(d)) return "";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}`;
    }

    const raw = asString.trim();
    if (!raw) return "";

    // dd/MM/yyyy → dd/MM
    const m1 = raw.match(/^(\d{2})\/(\d{2})\/\d{4}$/);
    if (m1) return `${m1[1]}/${m1[2]}`;

    // d/M or dd/MM → normalized dd/MM
    const m2 = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m2) {
      const dd = m2[1].padStart(2, "0");
      const mm = m2[2].padStart(2, "0");
      return `${dd}/${mm}`;
    }

    // plain day number → dd/MM (using fallback month)
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
      m === '"' ? "&quot;":
                  "&#39;"
    );
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON from server: ${text.slice(0, 120)}`);
    }
  }
})();
