/* mass-change.js (FULL, updated)
 * - CODER-only page gate
 * - DOES NOT load values from sheet into UI
 * - Start: writes all controls + row 12/13, triggers run,
 *          then displays logs returned by the run response
 *
 * IMPORTANT:
 * - Daily now DOES NOT require Level in UI (because GAS ignores B6 when B5=Daily)
 * - Still writes B6, but writes "" when Daily (cleaner)
 *
 * NOTE:
 * - Your GAS MUST return logs in JSON for mode:"run"
 *   Recommended GAS response shape:
 *   { ok:true, data:{ log:"...A20 text..." } }
 */

(function () {
  "use strict";

  // ===== CONFIG =====
  const CLOSE_URL = "/shared/attendance/reports/reports.html";
  const PROXY = "/.netlify/functions/mass-change"; // forwards to your GAS webapp

  // Control sheet mapping (your spec)
  const CELL = {
    report: "B5",
    level: "B6",
    sheet: "B7",
    range: "B8",
    changeType: "B11",
    color: "B14",
    fontSize: "B15",
    formulasRow: { row: 12, startCol: 2 }, // B
    valuesRow:   { row: 13, startCol: 2 }, // B
  };

  // ===== DOM =====
  const yy = document.getElementById("yy");
  const btnClose = document.getElementById("btnClose");
  const logBox = document.getElementById("logBox");

  const reportSel = document.getElementById("reportSel");
  const levelSel = document.getElementById("levelSel");
  const sheetInput = document.getElementById("sheetInput");
  const rangeInput = document.getElementById("rangeInput");
  const rangeHelpBtn = document.getElementById("rangeHelpBtn");

  const changeTypeSel = document.getElementById("changeTypeSel");

  const formulaList = document.getElementById("formulaList");
  const valueList = document.getElementById("valueList");
  const formulaPlus = document.getElementById("formulaPlus");
  const formulaMinus = document.getElementById("formulaMinus");
  const valuePlus = document.getElementById("valuePlus");
  const valueMinus = document.getElementById("valueMinus");

  const fontColorInput = document.getElementById("fontColorInput");
  const cellColorInput = document.getElementById("cellColorInput");
  const fontPickBtn = document.getElementById("fontPickBtn");
  const cellPickBtn = document.getElementById("cellPickBtn");

  const fontSizeInput = document.getElementById("fontSizeInput");
  const startBtn = document.getElementById("startBtn");

  // ===== UTIL =====
  function normRole(x){ return String(x || "").toUpperCase().trim(); }
  function getWho(){
    return (window.Auth && typeof Auth.who === "function") ? Auth.who() : null;
  }

  function setLog(text){
    if (!logBox) return;
    logBox.textContent = text || "";
  }

  function appendLog(line){
    if (!logBox) return;
    const prev = String(logBox.textContent || "");
    logBox.textContent = prev ? (prev + "\n" + line) : line;
  }

  function nowLine(msg){
    const d = new Date();
    const pad2 = (n) => String(n).padStart(2, "0");
    const ts = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    return `[${ts}] ${msg}`;
  }

  function isHex6(s){
    return /^#[0-9a-fA-F]{6}$/.test(String(s || "").trim());
  }

  function chooseColorForChangeType(){
    const ct = String((changeTypeSel && changeTypeSel.value) || "").toLowerCase().trim();
    const a = String((fontColorInput && fontColorInput.value) || "").trim();
    const b = String((cellColorInput && cellColorInput.value) || "").trim();

    if (ct === "font color") return a;
    if (ct === "cell color") return b;

    if (isHex6(a)) return a;
    if (isHex6(b)) return b;
    return "";
  }

  // ===== API (via Netlify proxy) =====
  async function apiSetCells(cells){
    const res = await fetch(PROXY, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      credentials:"same-origin",
      body: JSON.stringify({ mode:"setCells", cells })
    });
    if (!res.ok) throw new Error("POST setCells failed: " + res.status);
    const j = await res.json();
    if (!j || !j.ok) throw new Error((j && j.error) || "Bad response");
    return true;
  }

  async function apiSetRowValues(rowNum, startCol, values){
    const res = await fetch(PROXY, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      credentials:"same-origin",
      body: JSON.stringify({ mode:"setRowValues", row: rowNum, col: startCol, values })
    });
    if (!res.ok) throw new Error("POST setRowValues failed: " + res.status);
    const j = await res.json();
    if (!j || !j.ok) throw new Error((j && j.error) || "Bad response");
    return true;
  }

  async function apiRun(){
    const res = await fetch(PROXY, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      credentials:"same-origin",
      body: JSON.stringify({ mode:"run" })
    });
    if (!res.ok) throw new Error("POST run failed: " + res.status);
    const j = await res.json();
    if (!j || !j.ok) throw new Error((j && j.error) || "Bad response");
    return j; // EXPECT log/logs in this response
  }

  // ===== UI: multi fields =====
  function makeMultiInput(placeholder){
    const wrap = document.createElement("div");
    wrap.className = "multiItem";

    const inp = document.createElement("input");
    inp.type = "text";
    inp.autocomplete = "off";
    inp.spellcheck = false;
    inp.placeholder = placeholder || "";

    wrap.appendChild(inp);
    return { wrap, inp };
  }

  function getFormulaValues(){
    if (!formulaList) return [];
    return Array.from(formulaList.querySelectorAll("input")).map(i => i.value);
  }

  function getSetValues(){
    if (!valueList) return [];
    return Array.from(valueList.querySelectorAll("input")).map(i => i.value);
  }

  async function syncFormulasToSheet(){
    const vals = getFormulaValues();
    await apiSetRowValues(CELL.formulasRow.row, CELL.formulasRow.startCol, vals);
  }

  async function syncValuesToSheet(){
    const vals = getSetValues();
    await apiSetRowValues(CELL.valuesRow.row, CELL.valuesRow.startCol, vals);
  }

  function addFormulaField(value){
    if (!formulaList) return;
    const item = makeMultiInput("formula");
    item.inp.value = value || "";
    item.inp.addEventListener("change", () => {
      syncFormulasToSheet().catch(err => appendLog(nowLine("Formula sync failed: " + err.message)));
    });
    formulaList.appendChild(item.wrap);
  }

  function addValueField(value){
    if (!valueList) return;
    const item = makeMultiInput("value");
    item.inp.value = value || "";
    item.inp.addEventListener("change", () => {
      syncValuesToSheet().catch(err => appendLog(nowLine("Value sync failed: " + err.message)));
    });
    valueList.appendChild(item.wrap);
  }

  async function removeLastFormulaField(){
    if (!formulaList) return;
    const items = formulaList.querySelectorAll(".multiItem");
    if (!items.length) return;
    items[items.length - 1].remove();
    await syncFormulasToSheet();
  }

  async function removeLastValueField(){
    if (!valueList) return;
    const items = valueList.querySelectorAll(".multiItem");
    if (!items.length) return;
    items[items.length - 1].remove();
    await syncValuesToSheet();
  }

  // ===== Range info block =====
  const RANGE_INFO_TEXT =
`Range info
Column [A] [A:M] [B;C;G]
Row [2] [2:6] [5;9;11]
Cell [A2] [S3:T4] [F5;P8;AB6]`;

  let rangeInfoShown = false;

  function toggleRangeInfo(){
    const base =
`This program changes the structure, contents and styles of the daily reports and monthly reports en masse.

`;
    const currentLog = String((logBox && logBox.textContent) || "");
    let withoutInfo = currentLog;

    if (currentLog.includes(RANGE_INFO_TEXT)) {
      withoutInfo = currentLog.replace("\n\n" + RANGE_INFO_TEXT, "").replace(RANGE_INFO_TEXT, "");
    }

    rangeInfoShown = !rangeInfoShown;

    if (rangeInfoShown) {
      setLog(withoutInfo.trimEnd() + "\n\n" + RANGE_INFO_TEXT);
    } else {
      setLog(withoutInfo.trimEnd());
      if (logBox && !logBox.textContent.trim()) setLog(base.trimEnd());
    }
  }

  // ===== Pickr init =====
  function initPickr(buttonEl, inputEl){
    if (!window.Pickr || !buttonEl || !inputEl) return null;

    const pickr = Pickr.create({
      el: buttonEl,
      theme: "classic",
      default: "#ffffff",
      components: {
        preview: true,
        opacity: true,
        hue: true,
        interaction: {
          hex: true,
          rgba: true,
          hsla: true,
          input: true,
          clear: true,
          save: true
        }
      }
    });

    pickr.on("save", (color) => {
      try{
        // Force #RRGGBB
        const hex = color.toHEXA().toString().slice(0, 7);
        inputEl.value = hex;
      }catch(e){}
      pickr.hide();
    });

    return pickr;
  }

  // ===== MAIN =====
  async function boot(){
    if (yy) yy.textContent = String(new Date().getFullYear());

    // CODER-only gate
    const who = getWho();
    if (!who) { window.location.replace("/"); return; }
    const role = normRole(who.role);
    if (role !== "CODER") {
      window.location.replace(CLOSE_URL);
      return;
    }

    // init kebab menu UI (safe)
    if (window.LeftKebab && typeof LeftKebab.init === "function") {
      LeftKebab.init().catch(() => {});
    }

    if (btnClose) btnClose.addEventListener("click", () => window.location.assign(CLOSE_URL));

    // default description
    setLog("This program changes the structure, contents and styles of the daily reports and monthly reports en masse.");

    // range info button
    if (rangeHelpBtn) {
      rangeHelpBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleRangeInfo();
      });
    }

    // ensure at least one visible field each
    if (formulaList && !formulaList.querySelector("input")) addFormulaField("");
    if (valueList && !valueList.querySelector("input")) addValueField("");

    // plus/minus
    if (formulaPlus) {
      formulaPlus.addEventListener("click", async () => {
        addFormulaField("");
        try { await syncFormulasToSheet(); }
        catch (err) { appendLog(nowLine("Formula + failed: " + err.message)); }
      });
    }

    if (formulaMinus) {
      formulaMinus.addEventListener("click", async () => {
        try { await removeLastFormulaField(); }
        catch (err) { appendLog(nowLine("Formula − failed: " + err.message)); }
      });
    }

    if (valuePlus) {
      valuePlus.addEventListener("click", async () => {
        addValueField("");
        try { await syncValuesToSheet(); }
        catch (err) { appendLog(nowLine("Value + failed: " + err.message)); }
      });
    }

    if (valueMinus) {
      valueMinus.addEventListener("click", async () => {
        try { await removeLastValueField(); }
        catch (err) { appendLog(nowLine("Value − failed: " + err.message)); }
      });
    }

    // pickers
    initPickr(fontPickBtn, fontColorInput);
    initPickr(cellPickBtn, cellColorInput);

    // start
    if (startBtn) startBtn.addEventListener("click", onStart);
  }

  function extractLogs(runResponse){
    // Accept any of these shapes:
    // { ok:true, logs:[...] }
    // { ok:true, data:{ logs:[...] } }
    // { ok:true, log:"..." }
    // { ok:true, data:{ log:"..." } }
    const logs =
      (runResponse && runResponse.logs) ||
      (runResponse && runResponse.data && runResponse.data.logs) ||
      null;

    if (Array.isArray(logs)) return logs.map(x => String(x)).join("\n");

    const logStr =
      (runResponse && runResponse.log) ||
      (runResponse && runResponse.data && runResponse.data.log) ||
      "";

    return String(logStr || "");
  }

  async function onStart(){
    const report = String((reportSel && reportSel.value) || "").trim();
    const level  = String((levelSel && levelSel.value) || "").trim();
    const sheet  = String((sheetInput && sheetInput.value) || "").trim();
    const range  = String((rangeInput && rangeInput.value) || "").trim();
    const changeType = String((changeTypeSel && changeTypeSel.value) || "").trim();

    const reportUpper = report.toUpperCase();
    const needsLevel = (reportUpper !== "DAILY");

    // ✅ Daily does NOT require Level
    if (!report || !sheet || !range || !changeType || (needsLevel && !level)) {
      appendLog(nowLine("Please fill: Report, Sheet, Range, Type of change." + (needsLevel ? " Level is required for Monthly." : "")));
      return;
    }

    const formulas = getFormulaValues();
    const values   = getSetValues();
    const color    = chooseColorForChangeType();
    const fontSize = Number((fontSizeInput && fontSizeInput.value) || "");

    const ct = changeType.toLowerCase().trim();
    const needsColor = (ct === "font color" || ct === "cell color");
    if (needsColor && !isHex6(color)) {
      appendLog(nowLine('Color must be HEX like "#ff00aa".'));
      return;
    }

    const needsSize = (ct === "font size");
    if (needsSize && (!Number.isFinite(fontSize) || fontSize <= 0)) {
      appendLog(nowLine("Font size must be a number > 0."));
      return;
    }

    if (startBtn) startBtn.disabled = true;

    try{
      appendLog("");
      appendLog(nowLine("Writing control…"));

      await apiSetCells({
        [CELL.report]: report,
        // ✅ when Daily, write empty level (clean) — GAS ignores anyway
        [CELL.level]:  (reportUpper === "DAILY") ? "" : level,
        [CELL.sheet]: sheet,
        [CELL.range]: range,
        [CELL.changeType]: changeType,
        [CELL.color]: needsColor ? color : "",
        [CELL.fontSize]: needsSize ? fontSize : ""
      });

      await apiSetRowValues(CELL.formulasRow.row, CELL.formulasRow.startCol, formulas);
      await apiSetRowValues(CELL.valuesRow.row,   CELL.valuesRow.startCol, values);

      appendLog(nowLine("Running mass change…"));

      // Expect the response to include logs/log
      const runRes = await apiRun();

      appendLog(nowLine("Logs:"));

      const logsText = extractLogs(runRes);
      if (logsText.trim()) {
        appendLog("");
        appendLog(logsText);
      } else {
        appendLog("(No logs returned. Your GAS must return logs in the JSON response.)");
      }

      appendLog("");
      appendLog(nowLine("Done."));
    }catch(err){
      appendLog(nowLine("ERROR: " + err.message));
    }finally{
      if (startBtn) startBtn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
