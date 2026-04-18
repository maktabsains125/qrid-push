/* trans-class.js
 *
 * Updates requested:
 * ✅ goBtn disabled 5:00am–3:00pm Brunei time, EXCEPT Fri & Sun (always enabled those days)
 * ✅ Do NOT show error messages for UI ticking/progress issues
 * ✅ If backend returns ok:true => always show success message
 * ✅ If backend returns ok:false OR network fail => show a simple error (real backend failure)
 */

(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) { window.location.replace("/"); return; }

  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED_ROLES = ["CODER", "REGIS"];
  if (!ALLOWED_ROLES.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return;
  }

  const API_URL = "/.netlify/functions/trans-class";
  const $ = (id) => document.getElementById(id);

  // Form fields
  const fromLevelSel = $("fromLevelSelect");
  const fromClassSel = $("fromClassSelect");
  const toLevelSel   = $("toLevelSelect");
  const toClassSel   = $("toClassSelect");
  const dateIn       = $("dateIn");

  const stuNameSel   = $("stuNameSelect");
  const nameHint     = $("nameHint");

  const stuId        = $("stuId");
  const genderM      = $("genderM");
  const genderF      = $("genderF");

  const goBtn        = $("goBtn");
  const cancelBtn    = $("cancelBtn");

  // Progress / steps (kept in DOM; no error if they fail)
  const progressFill = $("progressFill");
  const progressPct  = $("progressPct");
  const tick1        = $("tick1");
  const tick2        = $("tick2");
  const tick3        = $("tick3");
  const finalMsg     = $("finalMsg");

  // Kebab menu
  const kebabBtn      = $("kebabBtn");
  const kebabPanel    = $("kebabPanel");
  const kebabDim      = $("kebabDim");
  const panelCloseBtn = $("panelCloseBtn");
  const navInto       = $("navInto");
  const navOut        = $("navOut");
  const navClass      = $("navClass");

  // State
  let currentStudent = null;      // { id, name, gender }
  let studentsIndex  = new Map(); // key=name|id -> student
  let progressTimer  = null;
  let isTransferring = false;

  // =========================================================
  // Time gate (Brunei): disable 05:00–15:00 except Fri & Sun
  // =========================================================
  function getBruneiNow_(){
    // Force Asia/Brunei regardless of device timezone
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Brunei",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(new Date());

    const map = {};
    parts.forEach(p => { if (p.type !== "literal") map[p.type] = p.value; });

    // weekday: Mon Tue Wed Thu Fri Sat Sun
    const wd = String(map.weekday || "");
    const hh = parseInt(map.hour || "0", 10);
    const mm = parseInt(map.minute || "0", 10);

    return { weekday: wd, minutes: (hh * 60 + mm) };
  }

  function isTimeBlockedBrunei_(){
    const now = getBruneiNow_();
    const wd = now.weekday; // "Fri", "Sun", ...
    if (wd === "Fri" || wd === "Sun") return false; // always enabled these days

    const m = now.minutes;
    // blocked: 05:00 (300) to 15:00 (900) inclusive start, exclusive end
    return (m >= 300 && m < 900);
  }

  // =========================================================
  // Menu
  // =========================================================
  function openMenu() {
    if (!kebabPanel) return;
    kebabPanel.hidden = false;
    kebabPanel.setAttribute("aria-hidden", "false");
  }
  function closeMenu() {
    if (!kebabPanel) return;
    kebabPanel.hidden = true;
    kebabPanel.setAttribute("aria-hidden", "true");
  }
  function goTo(url) { window.location.assign(url); }

  if (kebabBtn) kebabBtn.addEventListener("click", openMenu);
  if (panelCloseBtn) panelCloseBtn.addEventListener("click", closeMenu);
  if (kebabDim) kebabDim.addEventListener("click", closeMenu);

  if (navInto)  navInto.addEventListener("click", () => goTo("/shared/transfer/transpr/trans-into/trans-into.html"));
  if (navOut)   navOut.addEventListener("click", () => goTo("/shared/transfer/transpr/trans-out/trans-out.html"));
  if (navClass) navClass.addEventListener("click", () => closeMenu());

  // =========================================================
  // API
  // =========================================================
  async function callApi(payload) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  // =========================================================
  // Progress UI (best-effort only; NEVER treated as error)
  // =========================================================
  function safe_(fn){ try { fn(); } catch {} }

  function resetProgressUI() {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    safe_(() => { if (progressFill) progressFill.style.width = "0%"; });
    safe_(() => { if (progressPct)  progressPct.textContent = "0%"; });
    safe_(() => { if (tick1) tick1.textContent = ""; });
    safe_(() => { if (tick2) tick2.textContent = ""; });
    safe_(() => { if (tick3) tick3.textContent = ""; });
    safe_(() => { if (finalMsg) finalMsg.textContent = ""; });
  }

  function startFakeProgress() {
    resetProgressUI();
    let pct = 5;
    safe_(() => { if (progressFill) progressFill.style.width = pct + "%"; });
    safe_(() => { if (progressPct)  progressPct.textContent = pct + "%"; });

    progressTimer = setInterval(() => {
      if (pct < 90) {
        pct += 3;
        safe_(() => { if (progressFill) progressFill.style.width = pct + "%"; });
        safe_(() => { if (progressPct)  progressPct.textContent = pct + "%"; });
      }
    }, 400);
  }

  function finishSuccess(message) {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    safe_(() => { if (progressFill) progressFill.style.width = "100%"; });
    safe_(() => { if (progressPct)  progressPct.textContent = "100%"; });
    safe_(() => { if (tick1) tick1.textContent = "✓"; });
    safe_(() => { if (tick2) tick2.textContent = "✓"; });
    safe_(() => { if (tick3) tick3.textContent = "✓"; });
    if (finalMsg) finalMsg.textContent = message || "Transfer complete.";
  }

  function finishBackendFail(message) {
    // Only for REAL backend failures / network failures
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    safe_(() => { if (progressFill) progressFill.style.width = "0%"; });
    safe_(() => { if (progressPct)  progressPct.textContent = "0%"; });
    if (finalMsg) finalMsg.textContent = message || "Transfer failed.";
  }

  // =========================================================
  // Student UI
  // =========================================================
  function clearStudentInfo() {
    currentStudent = null;
    studentsIndex = new Map();

    if (stuNameSel) {
      stuNameSel.innerHTML = '<option value="">Select name</option>';
      stuNameSel.disabled = true;
    }
    if (nameHint) nameHint.textContent = "Choose Level + Class to load names.";

    if (stuId) stuId.value = "";
    if (genderM) genderM.checked = false;
    if (genderF) genderF.checked = false;
  }

  function updateTransferBtnState() {
    const hasStudent = !!currentStudent;
    const hasToClass = !!(toClassSel && toClassSel.value);
    const hasDate    = !!(dateIn && dateIn.value);

    const timeBlocked = isTimeBlockedBrunei_();

    // Disabled if:
    // - time window blocked (except Fri/Sun handled in isTimeBlockedBrunei_)
    // - missing required selections
    // - transferring
    const shouldDisable = timeBlocked || !(hasStudent && hasToClass && hasDate) || isTransferring;

    if (goBtn) goBtn.disabled = !!shouldDisable;

    // Optional: show a small hint when time-blocked (no error tone)
    if (finalMsg && timeBlocked && !isTransferring) {
      // Only show if nothing else is being shown
      if (!finalMsg.textContent) finalMsg.textContent = "Transfer is closed 5:00am–3:00pm (except Fri & Sun).";
    }
    if (finalMsg && !timeBlocked && finalMsg.textContent === "Transfer is closed 5:00am–3:00pm (except Fri & Sun).") {
      finalMsg.textContent = "";
    }
  }

  // Keep the button state accurate as time passes
  setInterval(updateTransferBtnState, 30 * 1000);

  // =========================================================
  // Load classes for a level
  // =========================================================
  async function handleLevelChange() {
    const level = fromLevelSel && fromLevelSel.value;

    clearStudentInfo();
    resetProgressUI();

    if (fromClassSel) {
      fromClassSel.innerHTML = '<option value="">Class</option>';
      fromClassSel.disabled = true;
    }
    if (toClassSel) {
      toClassSel.innerHTML = '<option value="">Class</option>';
      toClassSel.disabled = true;
    }

    if (!level) {
      if (toLevelSel) toLevelSel.value = "";
      updateTransferBtnState();
      return;
    }

    if (toLevelSel) toLevelSel.value = level;

    if (fromClassSel) {
      fromClassSel.innerHTML = '<option value="">Loading...</option>';
      fromClassSel.disabled = true;
    }

    try {
      const data = await callApi({ action: "getClasses", level });

      if (!data || !data.ok) {
        if (fromClassSel) fromClassSel.innerHTML = '<option value="">Class</option>';
        if (toClassSel)   toClassSel.innerHTML   = '<option value="">Class</option>';
        if (nameHint) nameHint.textContent = "Could not load classes.";
        updateTransferBtnState();
        return;
      }

      const classes = data.classes || [];
      const fragFrom = document.createDocumentFragment();
      const fragTo   = document.createDocumentFragment();

      classes.forEach(cls => {
        const opt1 = document.createElement("option");
        opt1.value = cls;
        opt1.textContent = cls;
        fragFrom.appendChild(opt1);

        const opt2 = document.createElement("option");
        opt2.value = cls;
        opt2.textContent = cls;
        fragTo.appendChild(opt2);
      });

      if (fromClassSel) {
        fromClassSel.innerHTML = '<option value="">Class</option>';
        fromClassSel.appendChild(fragFrom);
        fromClassSel.disabled = false;
      }

      if (toClassSel) {
        toClassSel.innerHTML = '<option value="">Class</option>';
        toClassSel.appendChild(fragTo);
        toClassSel.disabled = false;
      }

      if (nameHint) nameHint.textContent = "Choose From Class to load names.";
    } catch (err) {
      if (fromClassSel) fromClassSel.innerHTML = '<option value="">Class</option>';
      if (toClassSel)   toClassSel.innerHTML   = '<option value="">Class</option>';
      if (nameHint) nameHint.textContent = "Could not load classes.";
    } finally {
      updateTransferBtnState();
    }
  }

  // =========================================================
  // Load students when fromClass changes
  // =========================================================
  async function handleFromClassChange() {
    clearStudentInfo();
    resetProgressUI();
    updateTransferBtnState();

    const level = fromLevelSel && fromLevelSel.value;
    const fromClass = fromClassSel && fromClassSel.value;

    if (!level || !fromClass) {
      if (nameHint) nameHint.textContent = "Choose Level + Class to load names.";
      return;
    }

    if (stuNameSel) {
      stuNameSel.disabled = true;
      stuNameSel.innerHTML = '<option value="">Loading...</option>';
    }
    if (nameHint) nameHint.textContent = "Loading names from daily report…";

    try {
      const data = await callApi({ action: "getStudents", level, fromClass });

      if (!data || !data.ok) {
        if (stuNameSel) {
          stuNameSel.innerHTML = '<option value="">Select name</option>';
          stuNameSel.disabled = true;
        }
        if (nameHint) nameHint.textContent = "Failed to load names.";
        return;
      }

      const students = data.students || [];
      studentsIndex = new Map();

      const frag = document.createDocumentFragment();

      students.forEach((s) => {
        const name = String(s.name || "").trim();
        const id   = String(s.id || "").trim();
        const g    = String(s.gender || "").toUpperCase().trim();
        if (!name || !id || (g !== "M" && g !== "F")) return;

        const key = name + " | " + id; // unique
        studentsIndex.set(key, { name, id, gender: g });

        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = name;
        frag.appendChild(opt);
      });

      if (stuNameSel) {
        stuNameSel.innerHTML = '<option value="">Select name</option>';
        stuNameSel.appendChild(frag);
        stuNameSel.disabled = false;
      }

      if (nameHint) nameHint.textContent = "Loaded " + studentsIndex.size + " names.";
    } catch (err) {
      if (stuNameSel) {
        stuNameSel.innerHTML = '<option value="">Select name</option>';
        stuNameSel.disabled = true;
      }
      if (nameHint) nameHint.textContent = "Failed to load names.";
    } finally {
      updateTransferBtnState();
    }
  }

  // =========================================================
  // When name selected -> fill ID + gender
  // =========================================================
  function handleNameSelect() {
    currentStudent = null;

    if (stuId) stuId.value = "";
    if (genderM) genderM.checked = false;
    if (genderF) genderF.checked = false;

    const key = stuNameSel && stuNameSel.value;
    if (!key) { updateTransferBtnState(); return; }

    const s = studentsIndex.get(key);
    if (!s) { updateTransferBtnState(); return; }

    if (stuId) stuId.value = s.id;
    if (genderM) genderM.checked = (s.gender === "M");
    if (genderF) genderF.checked = (s.gender === "F");

    currentStudent = { id: s.id, name: s.name, gender: s.gender };
    updateTransferBtnState();
  }

  // =========================================================
  // Transfer click
  // =========================================================
  async function handleTransfer() {
    if (isTransferring) return;

    // Time gate: hard block click
    if (isTimeBlockedBrunei_()) {
      if (finalMsg) finalMsg.textContent = "Transfer is closed 5:00am–3:00pm (except Fri & Sun).";
      updateTransferBtnState();
      return;
    }

    const level     = fromLevelSel && fromLevelSel.value;
    const fromClass = fromClassSel && fromClassSel.value;
    const toClass   = toClassSel && toClassSel.value;
    const dateVal   = dateIn && dateIn.value;
    const idVal     = currentStudent && currentStudent.id;

    if (!level || !fromClass || !toClass || !dateVal || !idVal) {
      if (finalMsg) finalMsg.textContent = "Please complete all required fields first.";
      return;
    }
    if (fromClass === toClass) {
      if (finalMsg) finalMsg.textContent = "Transfer from and to the same class is not allowed.";
      return;
    }

    isTransferring = true;
    updateTransferBtnState();

    startFakeProgress();

    try {
      const data = await callApi({
        action: "transferClass",
        level,
        fromClass,
        toClass,
        stuId: idVal,
        dateIn: dateVal,
      });

      // ✅ Only treat as failure if backend says not ok
      if (!data || data.ok !== true) {
        finishBackendFail("Transfer failed. Please try again.");
        return;
      }

      // ✅ Backend success => always show success (UI updates best-effort)
      finishSuccess(data.message || "Transfer complete.");
    } catch (err) {
      // ✅ Real network/exception failure
      finishBackendFail("Transfer failed. Please try again.");
    } finally {
      isTransferring = false;
      updateTransferBtnState();
    }
  }

  // =========================================================
  // Cancel / reset
  // =========================================================
  function handleCancel() {
    if (isTransferring) return;

    if (fromLevelSel) fromLevelSel.value = "";
    if (toLevelSel)   toLevelSel.value   = "";

    if (fromClassSel) {
      fromClassSel.innerHTML = '<option value="">Class</option>';
      fromClassSel.disabled = true;
    }
    if (toClassSel) {
      toClassSel.innerHTML = '<option value="">Class</option>';
      toClassSel.disabled = true;
    }

    if (dateIn) dateIn.value = "";

    clearStudentInfo();
    resetProgressUI();
    updateTransferBtnState();
  }

  // =========================================================
  // Events
  // =========================================================
  if (fromLevelSel) fromLevelSel.addEventListener("change", handleLevelChange);
  if (fromClassSel) fromClassSel.addEventListener("change", handleFromClassChange);
  if (stuNameSel)   stuNameSel.addEventListener("change", handleNameSelect);

  if (toClassSel) toClassSel.addEventListener("change", updateTransferBtnState);
  if (dateIn) dateIn.addEventListener("change", updateTransferBtnState);

  if (goBtn) goBtn.addEventListener("click", handleTransfer);
  if (cancelBtn) cancelBtn.addEventListener("click", handleCancel);

  // Init
  handleCancel();
  updateTransferBtnState();

})();
