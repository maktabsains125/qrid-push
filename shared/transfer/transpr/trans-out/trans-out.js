/* trans-out.js — TRANSFER OUT + REVERSE (two separate Apps Scripts)
 *
 * CHANGE:
 * - Do NOT clear fields (transferTo + dateIn are never cleared by JS resets)
 * - "Transfer out to" is now a combobox via <datalist> in HTML (see HTML snippet below)
 */

(function () {
  "use strict";

  const PAGE_MODE = String(window.TRANS_OUT_PAGE_MODE || "transfer").toLowerCase(); // "transfer" or "reverse"
  const IS_REVERSE_PAGE = PAGE_MODE === "reverse";

  // ==========================================================
  // LOCK to signed in user only + ROLE allow-list
  // ==========================================================
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) { window.location.replace("/"); return; }

  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED_ROLES = ["CODER", "REGIS"];

  if (!ALLOWED_ROLES.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) dest = Auth.routeFor(role) || "/";
    window.location.replace(dest);
    return;
  }

  // ==========================================================
  // CONFIG (TWO BACKENDS)
  // ==========================================================
  const API_TRANSFER = "/.netlify/functions/trans-out";           // GAS #1
  const API_REVERSE  = "/.netlify/functions/trans-out-reverse";  // GAS #2
  const CLOSE_URL = "/shared/transfer/index.html";
  const REVERSE_PAGE_URL = "./trans-out-reverse.html";

  // ===== Elements =====
  const levelSelect = document.getElementById("levelSelect");
  const classSelect = document.getElementById("classSelect");

  const nameInput = document.getElementById("nameInput");
  const nameList  = document.getElementById("nameList");
  const nameCombo = document.getElementById("nameCombo");

  const transferTo  = document.getElementById("transferTo");
  const dateIn      = document.getElementById("dateIn");

  const idField     = document.getElementById("idField");
  const idActionBtn = document.getElementById("idActionBtn");

  const gM          = document.getElementById("gM");
  const gF          = document.getElementById("gF");

  const goBtn       = document.getElementById("goBtn");
  const cancelBtn   = document.getElementById("cancelBtn");
  const googleBtn   = document.getElementById("googleBtn");

  const progressFill = document.getElementById("progressFill");
  const progressPct  = document.getElementById("progressPct");

  const t1 = document.getElementById("t1");
  const t2 = document.getElementById("t2");
  const t3 = document.getElementById("t3");
  const t4 = document.getElementById("t4");

  const finalMsg    = document.getElementById("finalMsg");
  const logBox      = document.getElementById("logBox");

  // Kebab overlay
  const kebabBtn = document.getElementById("kebabBtn");
  const kebabPanel = document.getElementById("kebabPanel");
  const kebabDim = document.getElementById("kebabDim");
  const panelCloseBtn = document.getElementById("panelCloseBtn");

  const navInto  = document.getElementById("navInto");
  const navOut   = document.getElementById("navOut");
  const navClass = document.getElementById("navClass");

  const closeBtn = document.getElementById("closeBtn");
  const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1WhXW8yRIYE5VO_SRanOiJVJxkXD5ZD9SbDukyY7FhWo/edit?usp=sharing";

  // ===== State =====
  let busy = false;
  let allNames = [];
  let chosenName = "";

  // ==========================================================
  // Helpers
  // ==========================================================
  function setBusy(on){
    busy = !!on;

    if (goBtn) goBtn.disabled = busy;
	if (cancelBtn) cancelBtn.disabled = busy;

    if (levelSelect) levelSelect.disabled = busy;
    if (classSelect) classSelect.disabled = busy || !levelSelect.value;

    if (nameInput) nameInput.disabled = busy || !levelSelect.value || !classSelect.value;

    if (IS_REVERSE_PAGE) {
      if (transferTo) transferTo.disabled = true;
      if (idField) idField.disabled = true;
      if (gM) gM.disabled = true;
      if (gF) gF.disabled = true;
      if (dateIn) dateIn.disabled = true; // not used anymore (kept locked if exists in UI)
    } else {
      if (transferTo) transferTo.disabled = busy;
      if (dateIn) dateIn.disabled = busy;
      if (idField) idField.disabled = busy;
      if (gM) gM.disabled = busy;
      if (gF) gF.disabled = busy;
    }

    if (idActionBtn) idActionBtn.disabled = busy;
  }

  function setProgress(pct){
    try{
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      if (progressFill) progressFill.style.width = p + "%";
      if (progressPct) progressPct.textContent = p + "%";
    } catch(e){}
  }

  function clearTicks(){
    try{
      if (t1) t1.textContent = "";
      if (t2) t2.textContent = "";
      if (t3) t3.textContent = "";
      if (t4) t4.textContent = "";
    } catch(e){}
  }

  function tick(n){
    try{
      if (n === 1 && t1) t1.textContent = "✓";
      if (n === 2 && t2) t2.textContent = "✓";
      if (n === 3 && t3) t3.textContent = "✓";
      if (n === 4 && t4) t4.textContent = "✓";
    } catch(e){}
  }

  function log(line){
    try{
      if (!logBox) return;
      const now = new Date();
      const ts = now.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
      logBox.textContent += `[${ts}] ${line}\n`;
      logBox.scrollTop = logBox.scrollHeight;
    } catch(e){}
  }

  function toUpperInPlace(el){
    if (!el) return;
    el.value = (el.value || "").toUpperCase();
  }

  function normalizeClassValue(clsText){
    const s = String(clsText || "").trim();
    return s.replace(/^\d+/, "").trim();
  }

  function goTo(url){
    try{ window.location.href = url; } catch {}
  }

  function escapeHtml_(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function ymdToday_(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  // ==========================================================
  // Backend calls
  // ==========================================================
  async function apiGet(endpoint, params){
    const url = endpoint + "?" + new URLSearchParams(params).toString();
    const res = await fetch(url, { method:"GET", headers:{ "Accept":"application/json" }});
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json || json.ok === false) {
      throw new Error((json && json.error) ? json.error : `Request failed (${res.status})`);
    }
    return json;
  }

  async function apiPost(endpoint, payload){
    const res = await fetch(endpoint, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  }

  // ==========================================================
  // Verifier (for transient errors)
  // ==========================================================
  async function verifyTransferCompleted_(lvl, id, transferDate){
    try{
      const data = await apiGet(API_TRANSFER, {
        mode: "checkTransferOut",
        level: String(lvl),
        id: String(id || "").toUpperCase(),
        transferDate: String(transferDate || "")
      });
      return !!(data && data.ok && data.completed === true);
    } catch {
      return false;
    }
  }

  // ==========================================================
  // Kebab overlay
  // ==========================================================
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

  // ==========================================================
  // Reset helpers  (✅ DO NOT CLEAR transferTo/dateIn)
  // ==========================================================
  function resetStudent(){
    if (idField) idField.value = "";
    if (gM) gM.checked = false;
    if (gF) gF.checked = false;

    // do NOT clear transferTo
    // do NOT clear dateIn (except reverse locked display)
    if (dateIn && IS_REVERSE_PAGE) dateIn.value = ymdToday_();
  }

  function hideNameList(){
    if (!nameList) return;
    nameList.hidden = true;
    nameList.innerHTML = "";
  }

  function clearName(){
    allNames = [];
    chosenName = "";
    if (nameInput){
      nameInput.value = "";
      nameInput.disabled = true;
    }
    hideNameList();
  }

  function resetForm(keepLevel=false){
    clearTicks();
    setProgress(0);
    if (finalMsg) finalMsg.textContent = "";
    if (logBox) logBox.textContent = "";

    if (!keepLevel && levelSelect) levelSelect.value = "";

    if (classSelect){
      classSelect.innerHTML = `<option value="">Class</option>`;
      classSelect.disabled = true;
    }

    clearName();

    // do NOT clear transferTo/dateIn here
    if (IS_REVERSE_PAGE) {
      if (dateIn) dateIn.value = ymdToday_(); // locked display only
    }

    resetStudent();
  }

  // ==========================================================
  // Custom dropdown render (Name)
  // ==========================================================
  function filterNames(q){
    const needle = String(q || "").trim().toLowerCase();
    if (!needle) return allNames;
    return allNames.filter(n => String(n).toLowerCase().includes(needle));
  }

  function showNameList(matches){
    if (!nameList) return;

    const list = Array.isArray(matches) ? matches : [];
    if (list.length === 0){
      nameList.innerHTML = `<div class="comboEmpty">No matches</div>`;
      nameList.hidden = false;
      return;
    }

    const sliced = list.slice(0, 80);
    nameList.innerHTML = sliced.map(n => {
      const safeText = escapeHtml_(n);
      const safeAttr = escapeHtml_(n);
      return `<div class="comboItem" data-name="${safeAttr}">${safeText}</div>`;
    }).join("");

    nameList.hidden = false;
  }

  function refreshDropdown(){
    if (!nameInput) return;
    const matches = filterNames(nameInput.value);
    showNameList(matches);
  }

  // ==========================================================
  // Loaders
  // ==========================================================
  async function loadClasses(){
    const lvl = String(levelSelect.value || "").trim();
    if (!lvl) return;

    setBusy(true);
    try{
      log(`Loading classes for Year ${lvl}...`);
      setProgress(5);

      const data = IS_REVERSE_PAGE
        ? await apiGet(API_REVERSE,  { mode:"getReverseClasses", level:lvl })
        : await apiGet(API_TRANSFER, { mode:"getClasses", level:lvl });

      const classes = Array.isArray(data.classes) ? data.classes : [];

      classSelect.innerHTML =
        `<option value="">Class</option>` +
        classes.map(c => `<option value="${escapeHtml_(c)}">${escapeHtml_(c)}</option>`).join("");

      classSelect.disabled = false;

      // keep transferTo/dateIn; only reset name/id/gender
      clearName();
      resetStudent();

      setProgress(10);
      log(`Classes loaded: ${classes.length}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadNames(){
    const lvl = String(levelSelect.value || "").trim();
    const cls = String(classSelect.value || "").trim();
    if (!lvl || !cls) return;

    setBusy(true);
    try{
      log(`Loading names for ${lvl}${normalizeClassValue(cls)}...`);
      setProgress(15);

      const data = IS_REVERSE_PAGE
        ? await apiGet(API_REVERSE,  { mode:"getReverseNames", level:lvl, class:cls })
        : await apiGet(API_TRANSFER, { mode:"getNames", level:lvl, class:cls });

      const names = Array.isArray(data.names) ? data.names : [];

      allNames = names.slice();
      chosenName = "";

      if (nameInput){
        nameInput.disabled = false;
        nameInput.value = "";
      }
      hideNameList();

      // keep transferTo/dateIn; only reset id/gender
      resetStudent();

      setProgress(20);
      log(`Names loaded: ${names.length}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadStudentByName(nm){
    const lvl = String(levelSelect.value || "").trim();
    const cls = String(classSelect.value || "").trim();
    const name = String(nm || "").trim();
    if (!lvl || !cls || !name) return;

    setBusy(true);
    try{
      log(`Fetching student details...`);
      setProgress(25);

      let data;
      if (IS_REVERSE_PAGE) {
        data = await apiGet(API_REVERSE, { mode:"getReverseStudent", level:lvl, class:cls, name });
      } else {
        data = await apiGet(API_TRANSFER, { mode:"getStudent", level:lvl, class:cls, name });
      }

      if (idField) idField.value = String(data.id || "").toUpperCase();

      const g = String(data.gender || "").trim().toUpperCase();
      if (g === "M") { if (gM) gM.checked = true; if (gF) gF.checked = false; }
      else if (g === "F") { if (gF) gF.checked = true; if (gM) gM.checked = false; }
      else { if (gM) gM.checked = false; if (gF) gF.checked = false; }

      if (IS_REVERSE_PAGE && dateIn) dateIn.value = ymdToday_();

      setProgress(30);
      log(`Student loaded: ID ${(idField && idField.value) ? idField.value : ""} (${g || "?"})`);
    } finally {
      setBusy(false);
    }
  }

  // ==========================================================
  // Completion detection
  // ==========================================================
  function backendCompletedTransfer_(resOk, logs){
    if (resOk === true) return true;
    const lines = Array.isArray(logs) ? logs.map(s => String(s || "")) : [];
    const has1 = lines.some(s => /STEP 1 OK/i.test(s));
    const has3 = lines.some(s => /STEP 3 OK/i.test(s));
    const has4 = lines.some(s => /STEP 4 OK/i.test(s));
    return !!(has1 && has3 && has4);
  }

  function backendCompletedReverse_(resOk, logs){
    if (resOk === true) return true;
    const lines = Array.isArray(logs) ? logs.map(s => String(s || "")) : [];
    const hasDaily   = lines.some(s => /Daily restore OK|Daily block sorted/i.test(s));
    const hasMonthly = lines.some(s => /Monthly restore OK|Monthly sheet sorted|Monthly restore skipped/i.test(s));
    const hasTO      = lines.some(s => /TRANS OUT row cleared and compacted/i.test(s));
    const hasProfile = lines.some(s => /Profile CY cleared/i.test(s));
    return !!(hasDaily && hasTO && hasProfile && hasMonthly);
  }

  // ==========================================================
  // TRANSFER OUT (transfer page)
  // ==========================================================
  async function doTransfer(){
    if (busy) return;

    const lvl = String(levelSelect.value || "").trim();
    const clsRaw = String(classSelect.value || "").trim();
    const cls = clsRaw;

    const to = String(transferTo.value || "").trim();
    const d  = String(dateIn.value || "").trim();

    // keep uppercase behavior
    toUpperInPlace(transferTo);
    toUpperInPlace(idField);

    const name = String(chosenName || "").trim();

    if (!lvl || !cls || !to || !d || !name) {
      if (finalMsg) finalMsg.textContent = "Please complete all required fields (select a name from the list).";
      return;
    }

    setBusy(true);
    clearTicks();
    setProgress(35);
    if (finalMsg) finalMsg.textContent = "";
    if (logBox) logBox.textContent = "";

    try{
      log("Starting TRANSFER OUT...");
      log(`Year ${lvl}, Class ${clsRaw}, Name: ${name}`);
      log(`Transfer To: ${transferTo.value}`);
      log(`Transfer Date: ${d}`);

      const payload = {
        mode: "transferOut",
        level: Number(lvl),
        class: cls,
        transferTo: transferTo.value,
        transferDate: d,
        name
      };

      const { res, json } = await apiPost(API_TRANSFER, payload);
      const ok = !!(json && json.ok === true);
      const logs = Array.isArray(json && json.logs) ? json.logs : [];

      for (const line of logs) log(line);

      try{
        const step1 = logs.some(s => /STEP 1 OK|currentMonth copied/i.test(String(s)));
        const step2 = logs.some(s => /STEP 2 OK|pastMonth copied/i.test(String(s)));
        const step3 = logs.some(s => /STEP 3 OK|Transfer out appended/i.test(String(s)));
        const step4 = logs.some(s => /STEP 4 OK|TRANSFERRED written/i.test(String(s)));

        let p = 35;
        if (step1) { tick(1); p = 55; setProgress(p); }
        if (step2) { tick(2); p = 70; setProgress(p); }
        if (step3) { tick(3); p = 85; setProgress(p); }
        if (step4) { tick(4); p = 100; setProgress(p); }
        if (!step1 && !step2 && !step3 && !step4) setProgress(100);
      } catch(e){}

      const completed = backendCompletedTransfer_(ok, logs);
      if (completed) {
        setProgress(100);
        if (finalMsg) finalMsg.textContent = "Transfer completed ✅";
        return;
      }

      const errText =
        (json && json.error) ? String(json.error) :
        (!res.ok ? `Request failed (${res.status})` : "Unknown error");

      const maybeTransient = (!res.ok && [502,503,504].includes(res.status));
      if (maybeTransient) {
        log("Transient error; verifying completion...");
        const verified = await verifyTransferCompleted_(lvl, idField.value, d);
        if (verified) {
          setProgress(100);
          if (finalMsg) finalMsg.textContent = "Transfer completed ✅ (verified)";
          log("Verified completed after transient error.");
          return;
        }
      }

      if (finalMsg) finalMsg.textContent = "Transfer not completed. " + errText;
      log("Transfer not completed. " + errText);

    } catch (err){
      log("Request error; verifying completion...");
      const verified = await verifyTransferCompleted_(lvl, idField.value, d);
      if (verified) {
        setProgress(100);
        if (finalMsg) finalMsg.textContent = "Transfer completed ✅ (verified)";
        log("Verified completed after request error.");
      } else {
        setProgress(0);
        const msg = "Transfer not completed. " + (err && err.message ? err.message : String(err));
        if (finalMsg) finalMsg.textContent = msg;
        log(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  // ==========================================================
  // REVERSE
  // ==========================================================
  async function doReverse(){
    if (busy) return;

    const lvl = String(levelSelect.value || "").trim();
    const cls = String(classSelect.value || "").trim();
    const name = String(chosenName || "").trim();

    const id = String(idField && idField.value ? idField.value : "").trim().toUpperCase();
    toUpperInPlace(idField);

    if (!lvl || !cls || !name) {
      if (finalMsg) finalMsg.textContent = "Select Year, Class, and Name first.";
      return;
    }
    if (!id) {
      if (finalMsg) finalMsg.textContent = "Select a name first (ID is required).";
      return;
    }

    setBusy(true);
    clearTicks();
    setProgress(35);
    if (finalMsg) finalMsg.textContent = "";
    if (logBox) logBox.textContent = "";

    try{
      log("Starting REVERSE TRANSFER OUT (new flow)...");
      log(`Year ${lvl}, Class ${cls}, Name ${name}, ID ${id}`);

      const payload = {
        mode: "reverseTransferOut",
        level: Number(lvl),
        class: cls,
        name,
        id
      };

      const { res, json } = await apiPost(API_REVERSE, payload);
      const ok = !!(json && json.ok === true);
      const logs = Array.isArray(json && json.logs) ? json.logs : [];

      for (const line of logs) log(line);

      try{
        const a = logs.some(s => /Daily restore OK|Daily block sorted/i.test(String(s)));
        const b = logs.some(s => /Monthly restore OK|Monthly sheet sorted|Monthly restore skipped/i.test(String(s)));
        const c = logs.some(s => /TRANS OUT row cleared and compacted/i.test(String(s)));
        const d2= logs.some(s => /Profile CY cleared/i.test(String(s)));

        let p = 35;
        if (a) { tick(1); p = 55; setProgress(p); }
        if (b) { tick(2); p = 70; setProgress(p); }
        if (c) { tick(3); p = 85; setProgress(p); }
        if (d2){ tick(4); p = 100; setProgress(p); }
        if (!a && !b && !c && !d2) setProgress(100);
      } catch(e){}

      const completed = backendCompletedReverse_(ok, logs);
      if (completed) {
        setProgress(100);
        if (finalMsg) finalMsg.textContent = "Reverse completed ✅";
        return;
      }

      const errText =
        (json && json.error) ? String(json.error) :
        (!res.ok ? `Request failed (${res.status})` : "Unknown error");

      if (finalMsg) finalMsg.textContent = "Reverse not completed. " + errText;
      log("Reverse not completed. " + errText);

    } catch (err){
      setProgress(0);
      const msg = "Reverse not completed. " + (err && err.message ? err.message : String(err));
      if (finalMsg) finalMsg.textContent = msg;
      log(msg);
    } finally {
      setBusy(false);
    }
  }

  // ==========================================================
  // Events
  // ==========================================================
  if (levelSelect) {
    levelSelect.addEventListener("change", async () => {
      clearTicks();
      setProgress(0);
      if (finalMsg) finalMsg.textContent = "";
      if (logBox) logBox.textContent = "";

      if (classSelect){
        classSelect.disabled = true;
        classSelect.innerHTML = `<option value="">Class</option>`;
      }

      // keep transferTo/dateIn; only clear name/id/gender
      clearName();
      resetStudent();

      const lvl = String(levelSelect.value || "").trim();
      if (!lvl) return;
      await loadClasses();
    });
  }

  if (classSelect) {
    classSelect.addEventListener("change", async () => {
      clearTicks();
      setProgress(0);
      if (finalMsg) finalMsg.textContent = "";
      if (logBox) logBox.textContent = "";

      // keep transferTo/dateIn; only clear name/id/gender
      clearName();
      resetStudent();

      const cls = String(classSelect.value || "").trim();
      if (!cls) return;
      await loadNames();
    });
  }

  if (nameInput) {
    nameInput.addEventListener("input", () => {
      chosenName = "";

      // keep transferTo/dateIn; clear only id/gender when name is being changed
      resetStudent();

      refreshDropdown();
    });

    nameInput.addEventListener("focus", () => {
      if (!allNames.length) return;
      refreshDropdown();
    });

    document.addEventListener("pointerdown", (e) => {
      if (!nameCombo) return;
      if (nameCombo.contains(e.target)) return;
      hideNameList();
    });
  }

  if (nameList) {
    nameList.addEventListener("click", async (e) => {
      const item = e.target.closest(".comboItem");
      if (!item) return;

      const picked = item.getAttribute("data-name") || "";
      if (!picked) return;

      chosenName = picked;
      if (nameInput) nameInput.value = picked;
      hideNameList();

      await loadStudentByName(picked);
    });
  }

  // ✅ Transfer-to combobox input: keep uppercase
  if (!IS_REVERSE_PAGE && transferTo) {
    transferTo.addEventListener("input", () => toUpperInPlace(transferTo));
    transferTo.addEventListener("change", () => toUpperInPlace(transferTo));
    transferTo.addEventListener("blur", () => toUpperInPlace(transferTo));
  }

  if (idActionBtn) {
    idActionBtn.addEventListener("click", () => {
      const val = String(idField.value || "").trim();
      if (!val) return;
      navigator.clipboard?.writeText(val).then(
        () => { log("ID copied to clipboard."); },
        () => { log("Could not copy ID."); }
      );
    });
  }

  if (goBtn) {
    goBtn.addEventListener("click", IS_REVERSE_PAGE ? doReverse : doTransfer);
  }

  if (cancelBtn) {
    if (IS_REVERSE_PAGE) {
      cancelBtn.addEventListener("click", () => {
        if (busy) return;
        resetForm(false);
      });
    } else {
      cancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (busy) return;
        goTo(REVERSE_PAGE_URL);
      });
    }
  }
  
  if (googleBtn) {
   googleBtn.addEventListener("click", (e) => {
     e.preventDefault();
     window.open(GOOGLE_SHEET_URL, "_blank", "noopener");
   });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(CLOSE_URL);
    });
  }

  // ===== Kebab menu wiring =====
  if (kebabBtn) kebabBtn.addEventListener("click", openMenu);
  if (panelCloseBtn) panelCloseBtn.addEventListener("click", closeMenu);
  if (kebabDim) kebabDim.addEventListener("click", closeMenu);

  if (navInto)  navInto.addEventListener("click", ()=> goTo("/shared/transfer/transpr/trans-into/trans-into.html"));
  if (navOut)   navOut.addEventListener("click", ()=> goTo("/shared/transfer/transpr/trans-out/trans-out.html"));
  if (navClass) navClass.addEventListener("click", ()=> goTo("/shared/transfer/transpr/trans-class/trans-class.html"));

  if (kebabPanel){
    kebabPanel.addEventListener("click", (e) => {
      const btn = e.target.closest(".panel-item");
      if (!btn) return;

      const page = btn.getAttribute("data-page");
      if (!page) return;

      closeMenu();
      if (page === "transfer-into")  goTo("/shared/transfer/transpr/trans-into/trans-into.html");
      if (page === "transfer-out")   goTo("/shared/transfer/transpr/trans-out/trans-out.html");
      if (page === "transfer-class") goTo("/shared/transfer/transpr/trans-class/trans-class.html");
    });
  }

  // ===== Init =====
  resetForm(false);
  setBusy(false);

})();