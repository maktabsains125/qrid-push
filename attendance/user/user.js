/* user.js — USER CONTROLS */

(function () {
  "use strict";

  const CLOSE_URL = "/shared/attendance/reports/reports.html";
  const API = "/.netlify/functions/current-user";

  // ====== ROLE GATE (CODER + REGIS only) ======
  const ALLOW = new Set(["CODER", "REGIS"]);
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) { location.replace("/"); return; }
  const role = String(who.role || "").toUpperCase().trim();
  if (!ALLOW.has(role)) {
    const dest = (window.Auth && typeof Auth.routeFor === "function")
      ? (Auth.routeFor(role) || "/roles/general")
      : "/roles/general";
    location.replace(dest);
    return;
  }

  // ===== DOM =====
  const btnClose = document.getElementById("btnClose");

  const statusText = document.getElementById("statusText");
  const statusDots = document.getElementById("statusDots");
  const note = document.getElementById("note");
  const logBox = document.getElementById("logBox");

  const codeInput = document.getElementById("codeInput");
  const codeList  = document.getElementById("codeList");

  const fullName = document.getElementById("fullName");
  const phone    = document.getElementById("phone");
  const received = document.getElementById("received");
  const sessAM   = document.getElementById("sessAM");
  const sessPM   = document.getElementById("sessPM");

  const email           = document.getElementById("email");            // username only
  const emailDomain     = document.getElementById("emailDomain");      // combobox input
  const emailDomainList = document.getElementById("emailDomainList");  // dropdown

  const tally         = document.getElementById("tally");
  const btnClearTally = document.getElementById("btnClearTally");

  const btnEdit = document.getElementById("btnEdit");
  const btnSave = document.getElementById("btnSave");

  // Minimal required DOM guard (prevents hard crash)
  const REQUIRED = [btnClose, codeInput, codeList, fullName, received, sessAM, sessPM, email, tally, btnClearTally, btnEdit, btnSave, note, statusText, statusDots];
  if (REQUIRED.some(x => !x)) {
    console.error("USER CONTROLS: missing required DOM elements");
    // keep hidden (no reveal) to avoid broken UI flash
    return;
  }

  // ===== State =====
  let ALL_CODES = [];
  let CODE_MAP = {};       // uppercase -> canonical code
  let CURRENT_CODE = "";   // committed selection
  let MODE = "view";       // "view" | "edit"
  let LOADING = false;

  // ===== Email Domain Options (combobox) =====
  const DOMAIN_OPTIONS = [
    "@teacher.maktabsains.edu.moe.bn",
    "@maktabsains.edu.moe.bn"
  ];
  let DOMAIN_MAP = {}; // uppercase -> canonical

  // ===== Status UI =====
  function setStatus(text, mode) {
    if (statusText) statusText.textContent = text;

    const showDots = (mode === "wait" || mode === "saving");
    if (statusDots) statusDots.style.visibility = showDots ? "visible" : "hidden";
  }

  function setNote(msg) {
    if (note) note.textContent = msg || "";
  }

  function clearLog() {
    if (logBox) logBox.textContent = "";
  }

  function logLine(msg) {
    if (!logBox) return;
    const t = String(msg ?? "");
    logBox.textContent = (logBox.textContent ? logBox.textContent + "\n" : "") + t;
  }

  /* =================================================
     ✅ INIT LEFT KEBAB
     ================================================= */
  if (window.LeftKebab && typeof LeftKebab.init === "function") {
    LeftKebab.init();
  }

  // ===== Enable/disable fields by mode =====
  function applyMode(newMode) {
    MODE = newMode;

    const isEdit = MODE === "edit";
    fullName.disabled = !isEdit;
    if (phone) phone.disabled = !isEdit;
    received.disabled = !isEdit;
    sessAM.disabled = !isEdit;
    sessPM.disabled = !isEdit;
    email.disabled = !isEdit;
    if (emailDomain) emailDomain.disabled = !isEdit;
    tally.disabled = !isEdit;

    btnSave.disabled = !isEdit || !CURRENT_CODE || LOADING;
    btnClearTally.disabled = !isEdit || !CURRENT_CODE || LOADING;
    btnEdit.disabled = !CURRENT_CODE || LOADING;

    setStatus(isEdit ? "Edit mode" : "View mode", isEdit ? "edit" : "view");

    // when leaving edit mode, close domain combo
    if (!isEdit) closeDomainCombo();
  }

  function setLoading(isLoading, label) {
    LOADING = !!isLoading;
    if (LOADING) setStatus(label || "Please wait", "wait");

    btnEdit.disabled = LOADING || !CURRENT_CODE;
    btnSave.disabled = LOADING || MODE !== "edit" || !CURRENT_CODE;
    btnClearTally.disabled = LOADING || MODE !== "edit" || !CURRENT_CODE;
  }

  // ===== Helpers =====
  function esc(s) { return String(s || ""); }

  function currentSessionValue() {
    if (sessAM.checked) return "AM";
    if (sessPM.checked) return "PM";
    return "";
  }

  function setSessionValue(v) {
    const val = String(v || "").toUpperCase().trim();
    sessAM.checked = (val === "AM");
    sessPM.checked = (val === "PM");
  }

  // ✅ Phone: allow blank OR exactly 7 digits (strip non-digits)
  function normalizePhone(raw) {
    const v = String(raw ?? "").trim();
    if (!v) return "";
    const digits = v.replace(/\D/g, "");
    if (digits.length !== 7) return null;
    return digits;
  }

  // ===== Email split/build =====
  function splitEmail_(raw) {
    const v = String(raw || "").trim();
    if (!v) return { user: "", dom: "" };

    const at = v.indexOf("@");
    if (at === -1) return { user: v, dom: "" };

    const user = v.slice(0, at).trim();
    const domRaw = v.slice(at + 1).trim();
    const dom = domRaw ? ("@" + domRaw.replace(/^@+/, "")) : "";
    return { user, dom };
  }

  function setEmailFieldsFromFull_(full) {
    const { user, dom } = splitEmail_(full);
    email.value = user;

    if (dom && emailDomain) {
      const hit = DOMAIN_MAP[dom.toUpperCase()];
      emailDomain.value = hit ? hit : dom;
    }
  }

  function buildEmail_() {
    const user = String(email.value || "").trim();
    if (!user) return "";

    let dom = emailDomain ? String(emailDomain.value || "").trim() : "";
    if (dom && !dom.startsWith("@")) dom = "@" + dom;
    if (!dom) return user;

    return user + dom;
  }

  // ===== Domain combobox helpers =====
  function openDomainCombo() {
    if (!emailDomainList) return;
    emailDomainList.hidden = false;
    if (emailDomain) emailDomain.setAttribute("aria-expanded", "true");
  }

  function closeDomainCombo() {
    if (!emailDomainList) return;
    emailDomainList.hidden = true;
    if (emailDomain) emailDomain.setAttribute("aria-expanded", "false");
  }

  function filterDomains(q) {
    const query = String(q || "").trim().toUpperCase();
    if (!query) return DOMAIN_OPTIONS.slice();
    return DOMAIN_OPTIONS.filter(d => d.toUpperCase().includes(query));
  }

  function renderDomainList(items) {
    if (!emailDomainList) return;
    emailDomainList.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "comboEmpty";
      empty.textContent = "No matches";
      emailDomainList.appendChild(empty);
      openDomainCombo();
      return;
    }

    items.slice(0, 50).forEach(dom => {
      const div = document.createElement("div");
      div.className = "comboItem";
      div.textContent = dom;

      div.addEventListener("mousedown", (ev) => ev.preventDefault());
      div.addEventListener("click", (e) => {
        e.stopPropagation();
        if (emailDomain) emailDomain.value = dom;
        closeDomainCombo();
      });

      emailDomainList.appendChild(div);
    });

    openDomainCombo();
  }

  function snapDomainToCanonical_() {
    if (!emailDomain) return;
    const typed = String(emailDomain.value || "").trim();
    if (!typed) return;

    const norm = typed.startsWith("@") ? typed : ("@" + typed);
    const hit = DOMAIN_MAP[norm.toUpperCase()];
    emailDomain.value = hit ? hit : norm;
  }

  function fillFields(user) {
    fullName.value = esc(user.fullName);
    if (phone) phone.value = esc(user.phone);
    received.checked = !!user.received;
    setSessionValue(user.session);

    // ✅ email text shows only username; domain goes to domain field
    const fullEmail = esc(user.email);
    if (fullEmail) setEmailFieldsFromFull_(fullEmail);
    else { email.value = ""; if (emailDomain) emailDomain.value = ""; }

    tally.value = esc(user.tally);
  }

  function clearFields() {
    fullName.value = "";
    if (phone) phone.value = "";
    received.checked = false;
    sessAM.checked = false;
    sessPM.checked = false;

    email.value = "";
    if (emailDomain) emailDomain.value = "";

    tally.value = "";
  }

  function setSelectedCode(code) {
    CURRENT_CODE = String(code || "").trim();
    codeInput.value = CURRENT_CODE;

    btnEdit.disabled = !CURRENT_CODE || LOADING;
    btnSave.disabled = MODE !== "edit" || !CURRENT_CODE || LOADING;
    btnClearTally.disabled = MODE !== "edit" || !CURRENT_CODE || LOADING;
  }

  // ===== Combobox open/close (ARIA) =====
  function openCombo() {
    codeList.hidden = false;
    codeInput.setAttribute("aria-expanded", "true");
  }

  function closeCombo() {
    codeList.hidden = true;
    codeInput.setAttribute("aria-expanded", "false");
  }

  // ===== Combobox (type to filter, click to select) =====
  function renderCodeList(items) {
    codeList.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "comboEmpty";
      empty.textContent = "No matches";
      codeList.appendChild(empty);
      openCombo();
      return;
    }

    items.slice(0, 200).forEach(code => {
      const div = document.createElement("div");
      div.className = "comboItem";
      div.textContent = code;

      div.addEventListener("mousedown", (ev) => ev.preventDefault());
      div.addEventListener("click", (e) => {
        e.stopPropagation();
        closeCombo();
        selectCode(code);
      });

      codeList.appendChild(div);
    });

    openCombo();
  }

  function filterCodes(q) {
    const query = String(q || "").trim().toUpperCase();
    if (!query) return ALL_CODES.slice(0, 200);
    return ALL_CODES
      .filter(c => String(c).toUpperCase().includes(query))
      .slice(0, 200);
  }

  // ===== API calls =====
  async function apiGet(action, params) {
    const url = new URL(API, location.origin);
    url.searchParams.set("action", action);
    if (params) Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));

    const r = await fetch(url.toString(), { method: "GET" });
    const j = await r.json();
    if (!j || j.ok !== true) throw new Error((j && j.error) || "API error");
    return j;
  }

  async function apiPost(payload) {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
    const j = await r.json();
    if (!j || j.ok !== true) throw new Error((j && j.error) || "API error");
    return j;
  }

  // ===== Load codes =====
  async function loadCodes() {
    setLoading(true, "Please wait");
    setNote("");
    clearLog();

    try {
      const j = await apiGet("codes");
      ALL_CODES = Array.isArray(j.codes) ? j.codes : [];

      CODE_MAP = {};
      ALL_CODES.forEach(c => { CODE_MAP[String(c).toUpperCase()] = c; });

      setSelectedCode("");
      clearFields();

      setStatus("View mode", "view");
      if (statusDots) statusDots.style.visibility = "hidden";
      setNote(ALL_CODES.length ? "" : "No codes found in col A.");
    } catch (err) {
      setStatus("Error", "error");
      if (statusDots) statusDots.style.visibility = "hidden";
      const msg = String(err && err.message ? err.message : err);
      setNote(msg);
      logLine(msg);
    } finally {
      setLoading(false);
      applyMode("view");
      closeCombo();
    }
  }

  // ===== Select code (commits selection) =====
  async function selectCode(code) {
    const picked = String(code || "").trim();
    if (!picked) return;

    setSelectedCode(picked);
    clearFields();
    applyMode("view");

    setLoading(true, "Please wait");
    setNote("");
    clearLog();

    try {
      const j = await apiGet("get", { code: CURRENT_CODE });
      fillFields(j.user || {});
      applyMode("view");
    } catch (err) {
      setStatus("Error", "error");
      if (statusDots) statusDots.style.visibility = "hidden";
      const msg = String(err && err.message ? err.message : err);
      setNote(msg);
      logLine(msg);
      setSelectedCode("");
      clearFields();
    } finally {
      setLoading(false);
      applyMode(MODE);
    }
  }

  // ===== Edit / Save / Clear tally =====
  function enterEdit() {
    if (!CURRENT_CODE) return;
    setNote("");
    applyMode("edit");
  }

  async function saveUser() {
    if (!CURRENT_CODE) return;

    setLoading(true, "Saving");
    setNote("");
    clearLog();

    try {
      // ✅ validate phone before sending
      const phoneNorm = phone ? normalizePhone(phone.value) : "";
      if (phone && phoneNorm === null) {
        setStatus("Error", "error");
        if (statusDots) statusDots.style.visibility = "hidden";
        setNote("Invalid phone. Must be exactly 7 digits (or blank).");
        applyMode("edit");
        setLoading(false);
        return;
      }

      // ✅ snap domain to canonical form if possible
      snapDomainToCanonical_();

      // ✅ email input must be username only; if user pasted full email, split it
      if (email.value.includes("@")) {
        setEmailFieldsFromFull_(email.value);
      }

      const payload = {
        action: "save",
        code: CURRENT_CODE,
        received: !!received.checked,
        fullName: String(fullName.value || "").trim().toUpperCase(),
        phone: phoneNorm,
        session: currentSessionValue(),
        email: buildEmail_(),
        tally: String(tally.value ?? "").trim()
      };

      const j = await apiPost(payload);

      fillFields(j.user || {});
      applyMode("view");
      setNote("Saved.");
    } catch (err) {
      setStatus("Error", "error");
      if (statusDots) statusDots.style.visibility = "hidden";
      const msg = String(err && err.message ? err.message : err);
      setNote(msg);
      logLine(msg);
      applyMode("edit");
    } finally {
      setLoading(false);
      applyMode(MODE);
    }
  }

  async function clearTallyNow() {
    if (!CURRENT_CODE) return;

    setLoading(true, "Saving");
    setNote("");
    clearLog();

    try {
      const j = await apiPost({ action: "clearTally", code: CURRENT_CODE });
      fillFields(j.user || {});
      setNote("Tally cleared.");
      applyMode("edit");
    } catch (err) {
      setStatus("Error", "error");
      if (statusDots) statusDots.style.visibility = "hidden";
      const msg = String(err && err.message ? err.message : err);
      setNote(msg);
      logLine(msg);
    } finally {
      setLoading(false);
      applyMode(MODE);
    }
  }

  // ===== Events =====
  btnClose.addEventListener("click", () => { location.href = CLOSE_URL; });

  btnEdit.addEventListener("click", enterEdit);
  btnSave.addEventListener("click", saveUser);
  btnClearTally.addEventListener("click", clearTallyNow);

  // ✅ Phone: digits only + max 7 (edit mode only)
  if (phone) {
    phone.addEventListener("input", () => {
      if (MODE !== "edit") return;
      phone.value = String(phone.value || "").replace(/\D/g, "").slice(0, 7);
    });
  }

  // ✅ Email must be username only; move @domain to domain box immediately
  if (email) {
    email.addEventListener("input", () => {
      if (MODE !== "edit") return;
      const v = String(email.value || "");
      if (v.includes("@")) setEmailFieldsFromFull_(v);
    });

    email.addEventListener("blur", () => {
      if (MODE !== "edit") return;
      const v = String(email.value || "").trim();
      if (v.includes("@")) setEmailFieldsFromFull_(v);
    });
  }

  // ✅ Domain combobox behavior (only active in edit mode)
  if (emailDomain && emailDomainList) {
    emailDomain.addEventListener("focus", () => {
      if (MODE !== "edit") return;
      renderDomainList(filterDomains(emailDomain.value));
    });

    emailDomain.addEventListener("click", (e) => {
      if (MODE !== "edit") return;
      e.stopPropagation();
      renderDomainList(filterDomains(emailDomain.value));
    });

    emailDomain.addEventListener("input", () => {
      if (MODE !== "edit") return;
      renderDomainList(filterDomains(emailDomain.value));
    });

    emailDomain.addEventListener("keydown", (e) => {
      if (MODE !== "edit") return;

      if (e.key === "Escape") {
        closeDomainCombo();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        closeDomainCombo();
        snapDomainToCanonical_();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        renderDomainList(filterDomains(emailDomain.value));
        return;
      }
    });

    // close when clicking outside domain combo
    document.addEventListener("click", (e) => {
      const inside = (e.target === emailDomain) || emailDomainList.contains(e.target);
      if (!inside) closeDomainCombo();
    });
  }

  // Combobox behavior (codes)
  codeInput.addEventListener("focus", () => {
    renderCodeList(filterCodes(codeInput.value));
  });

  codeInput.addEventListener("click", (e) => {
    e.stopPropagation();
    renderCodeList(filterCodes(codeInput.value));
  });

  codeInput.addEventListener("input", () => {
    renderCodeList(filterCodes(codeInput.value));
    btnEdit.disabled = !CURRENT_CODE || LOADING;
  });

  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCombo();
      codeInput.value = CURRENT_CODE;
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const typed = String(codeInput.value || "").trim();
      const hit = CODE_MAP[typed.toUpperCase()];
      if (hit) {
        closeCombo();
        selectCode(hit);
      } else {
        closeCombo();
        codeInput.value = CURRENT_CODE;
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      renderCodeList(filterCodes(codeInput.value));
      return;
    }
  });

  // On blur: snap back unless it matches CURRENT_CODE (delay so list click works)
  codeInput.addEventListener("blur", () => {
    setTimeout(() => {
      const v = String(codeInput.value || "").trim();
      if (v !== CURRENT_CODE) codeInput.value = CURRENT_CODE;
      closeCombo();
    }, 120);
  });

  // Close when clicking outside (codes)
  document.addEventListener("click", (e) => {
    const inside = (e.target === codeInput) || codeList.contains(e.target);
    if (!inside) {
      closeCombo();
      const v = String(codeInput.value || "").trim();
      if (v !== CURRENT_CODE) codeInput.value = CURRENT_CODE;
    }
  });

  // ===== Init =====
  (async function init() {
    // build domain map
    DOMAIN_MAP = {};
    DOMAIN_OPTIONS.forEach(d => { DOMAIN_MAP[d.toUpperCase()] = d; });

    // ARIA defaults (codes)
    codeInput.setAttribute("role", "combobox");
    codeInput.setAttribute("aria-autocomplete", "list");
    codeInput.setAttribute("aria-expanded", "false");
    codeInput.setAttribute("aria-controls", "codeList");

    // ARIA defaults (domain)
    if (emailDomain) {
      emailDomain.setAttribute("role", "combobox");
      emailDomain.setAttribute("aria-autocomplete", "list");
      emailDomain.setAttribute("aria-expanded", "false");
      emailDomain.setAttribute("aria-controls", "emailDomainList");
    }

    setStatus("Please wait", "wait");
    if (statusDots) statusDots.style.visibility = "visible";

    await loadCodes();

    // ✅ Reveal ONLY after role gate + init finished (prevents “glimpse”)
    document.documentElement.style.visibility = "visible";
  })();

})();