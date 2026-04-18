/* shared/camera/bookings/admin-book.js */

(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  ready(() => {
    // ===== AUTH GATE: ADMIN/CODER only =====
    const who = (window.Auth && Auth.who && Auth.who()) || null;
    if (!who) {
      location.replace("/");
      return;
    }
    const role = String(who.role || "").toUpperCase().trim();
    const ALLOWED = new Set(["ADMIN", "CODER"]);
    if (!ALLOWED.has(role)) {
      location.replace(Auth.routeFor ? Auth.routeFor(role) : "/");
      return;
    }

    // ===== CONFIG =====
    const API = "/.netlify/functions/adbook-netlify";
    const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV"];

    // ===== DOM =====
    const $ = (id) => document.getElementById(id);

    const xBtn = $("xBtn");
    const statusMsg = $("statusMsg");

    const amBtn = $("amBtn");
    const pmBtn = $("pmBtn");
    const tableCard = $("tableCard");
    const tableWrap = $("tableWrap");

    // Kebab
    const kebabBtn = $("kebabBtn");
    const overlay = $("overlay");
    const overlayDim = $("overlayDim");
    const panelClose = $("panelClose");

    const goBook = $("goBook");
    const goMine = $("goMine");
    const goAdmin = $("goAdmin");

    // Modal
    const modal = $("modal");
    const modalDim = $("modalDim");
    const modalClose = $("modalClose");
    const modalTitle = $("modalTitle");
    const modalBody = $("modalBody");

    // CALC (read-only)
    const c_pmTeachersTotal = $("c_pmTeachersTotal"); // R10
    const c_amTeachersTotal = $("c_amTeachersTotal"); // R11
    const c_shift1SlotsTotal = $("c_shift1SlotsTotal"); // R7
    const c_shift2SlotsTotal = $("c_shift2SlotsTotal"); // S7
    const c_shift3SlotsTotal = $("c_shift3SlotsTotal"); // T7
    const c_shift1and3Total = $("c_shift1and3Total");   // R8
    const c_shiftsTotal = $("c_shiftsTotal");           // R9
    const c_amPerYear = $("c_amPerYear");               // T10
    const c_amPerMonth = $("c_amPerMonth");             // R12
    const c_pmPerYear = $("c_pmPerYear");               // T11
    const c_pmPerMonth = $("c_pmPerMonth");             // R13

    // CONTROLS (editable)
    const openMonth = $("openMonth");   // R4

    const slotsShift1 = $("slotsShift1"); // R6
    const slotsShift2 = $("slotsShift2"); // S6
    const slotsShift3 = $("slotsShift3"); // T6

    const maxPerMonthAM = $("maxPerMonthAM"); // T12
    const maxPerMonthPM = $("maxPerMonthPM"); // T13

    const setAvgAM = $("setAvgAM"); // U12
    const setAvgPM = $("setAvgPM"); // U13

    const shift1Start = $("shift1Start"); // T15
    const shift1End   = $("shift1End");   // U15
    const shift2Start = $("shift2Start"); // T16
    const shift2End   = $("shift2End");   // U16
    const shift3Start = $("shift3Start"); // T17
    const shift3End   = $("shift3End");   // U17

    // Center status overlay (Saving... / Saved)
    const saveOverlay  = $("saveOverlay");
    const saveCardText = $("saveCardText");

    // ===== TOP status (existing) =====
    function topStatusLoading() {
      if (!statusMsg) return;
      statusMsg.innerHTML =
        `Loading. Please wait<span class="dotsBox"><span class="dots"></span></span>`;
    }
    function topStatus(text) {
      if (!statusMsg) return;
      statusMsg.textContent = text || "";
    }

    // ===== CENTER status (Saving/Saved) =====
    let saveHideT = null;

    function showSave(text) {
      if (!saveOverlay || !saveCardText) return;
      if (saveHideT) { clearTimeout(saveHideT); saveHideT = null; }
      saveCardText.textContent = text || "";
      saveOverlay.hidden = false;
    }

    function showSavedThenHide(ms = 700) {
      showSave("Saved.");
      saveHideT = setTimeout(() => {
        if (saveOverlay) saveOverlay.hidden = true;
      }, ms);
    }

    function hideSave() {
      if (saveHideT) { clearTimeout(saveHideT); saveHideT = null; }
      if (saveOverlay) saveOverlay.hidden = true;
    }

    // ===== NAV =====
    xBtn?.addEventListener("click", () => location.replace("/shared/camera/index.html"));

    // ===== KEBAB =====
    function openMenu() {
      if (!overlay) return;
      overlay.hidden = false;
    }
    function closeMenu() {
      if (!overlay) return;
      overlay.hidden = true;
    }

    kebabBtn?.addEventListener("click", () => {
      if (!overlay) return;
      overlay.hidden ? openMenu() : closeMenu();
    });
    overlayDim?.addEventListener("click", closeMenu);
    panelClose?.addEventListener("click", closeMenu);

    goBook?.addEventListener("click", () => location.assign("/shared/camera/greetings/bookings.html"));
    goMine?.addEventListener("click", () => location.assign("/shared/camera/schedule/my-schedule.html"));
    goAdmin?.addEventListener("click", () => location.assign("/shared/camera/admin/admin-book.html"));

    // ===== MODAL =====
    function openModal(title, html) {
      if (!modal || !modalTitle || !modalBody) return;
      modalTitle.textContent = title || "Teacher";
      modalBody.innerHTML = html || "";
      modal.hidden = false;
    }
    function closeModal() {
      if (!modal) return;
      modal.hidden = true;
    }
    modalDim?.addEventListener("click", closeModal);
    modalClose?.addEventListener("click", closeModal);

    // ===== API =====
    async function apiGet(params) {
      const url = new URL(API, location.origin);
      Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
      const r = await fetch(url.toString(), { method: "GET" });
      const text = await r.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Bad JSON");
      }
      if (!data || data.ok !== true) throw new Error(data?.error || "Request failed");
      return data;
    }

    async function apiPost(payload) {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
      const text = await r.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Bad JSON");
      }
      if (!data || data.ok !== true) throw new Error(data?.error || "Request failed");
      return data;
    }

    // ===== TABLE =====
    function sumMonths(arr) {
      if (!Array.isArray(arr)) return 0;
      let s = 0;
      for (const v of arr) {
        const n = Number(v || 0);
        if (!Number.isNaN(n)) s += n;
      }
      return s;
    }

    function renderTable(session, rows) {
      if (!tableWrap || !tableCard) return;

      const thead = `
        <thead>
          <tr>
            <th class="stickyCol">CODE</th>
            <th class="fullname">FULL NAME</th>
            <th>TOTAL BOOKINGS</th>
            ${MONTHS.map((m) => `<th>${m}</th>`).join("")}
          </tr>
        </thead>
      `;

      const tbody = `
        <tbody>
          ${rows
            .map((r, idx) => {
              const total = sumMonths(r.months);
              const monthsTds = MONTHS.map((_, i) => {
                const v = Number(r.months?.[i] || 0);
                let cls = "";
                if (v === 1) cls = "month-1";
                else if (v > 1) cls = "month-gt1";
                return `<td class="${cls}">${v}</td>`;
              }).join("");

              return `
                <tr data-idx="${idx}">
                  <td class="stickyCol">${String(r.code || "")}</td>
                  <td class="fullname">${String(r.name || "")}</td>
                  <td>${total}</td>
                  ${monthsTds}
                </tr>
              `;
            })
            .join("")}
        </tbody>
      `;

      tableWrap.innerHTML = `<table class="grid" id="grid">${thead}${tbody}</table>`;
      tableCard.hidden = false;

      const grid = document.getElementById("grid");
      grid?.addEventListener("click", (e) => {
        const tr = e.target?.closest("tr");
        if (!tr) return;
        const idx = Number(tr.getAttribute("data-idx"));
        const r = rows[idx];
        if (!r) return;

        const total = sumMonths(r.months);
        const monthLines = MONTHS.map(
          (m, i) => `
            <div class="kv">
              <div class="k">${m}</div>
              <div class="v">${Number(r.months?.[i] || 0)}</div>
            </div>
          `
        ).join("");

        const html = `
          <div class="kv"><div class="k">SESSION</div><div class="v">${session}</div></div>
          <div class="kv"><div class="k">CODE</div><div class="v">${String(r.code || "")}</div></div>
          <div class="kv"><div class="k">FULL NAME</div><div class="v">${String(r.name || "")}</div></div>
          <div class="kv"><div class="k">TOTAL</div><div class="v">${total}</div></div>
          <div style="height:8px"></div>
          ${monthLines}
        `;

        openModal(`${r.code || "Teacher"}`, html);
      });
    }

    function renderError(err) {
      if (!tableWrap || !tableCard) return;
      tableCard.hidden = false;
      tableWrap.innerHTML = `
        <div class="gridError">
          Failed to load.<br/>
          ${String(err?.message || err)}
        </div>
      `;
    }

    async function loadSession(session) {
      try {
        topStatusLoading();
        const data = await apiGet({ mode: "getAdminTable", session });
        renderTable(session, data.rows || []);
        topStatus("");
      } catch (err) {
        renderError(err);
        topStatus(String(err?.message || err));
      }
    }

    amBtn?.addEventListener("click", () => loadSession("AM"));
    pmBtn?.addEventListener("click", () => loadSession("PM"));

    // ===== COUNTERS (fetch -> show -> edit -> write back) =====
    function setText(node, v) {
      if (!node) return;
      node.textContent = (v == null || v === "") ? "—" : String(v);
    }
    function setValue(node, v) {
      if (!node) return;
      node.value = (v == null) ? "" : String(v);
    }
    function setSelect(node, v) {
      if (!node) return;
      const val = String(v || "").toUpperCase().trim();
      node.value = MONTHS.includes(val) ? val : "";
    }

    // showTop=false prevents "Loading..." flash during saves
    async function loadCounters(showTop = true) {
      try {
        if (showTop) topStatusLoading();
        const data = await apiGet({ mode: "getCounters" });
        const c = data.counters || {};

        // ---- CALCULATIONS (read-only) ----
        setText(c_pmTeachersTotal, c.R10);
        setText(c_amTeachersTotal, c.R11);

        setText(c_shift1SlotsTotal, c.R7);
        setText(c_shift2SlotsTotal, c.S7);
        setText(c_shift3SlotsTotal, c.T7);

        setText(c_shift1and3Total, c.R8);
        setText(c_shiftsTotal, c.R9);

        setText(c_amPerYear, c.T10);
        setText(c_amPerMonth, c.R12);

        setText(c_pmPerYear, c.T11);
        setText(c_pmPerMonth, c.R13);

        // ---- CONTROLS (editable, fetched first) ----
        setSelect(openMonth, c.R4);

        setValue(slotsShift1, c.R6);
        setValue(slotsShift2, c.S6);
        setValue(slotsShift3, c.T6);

        setValue(maxPerMonthAM, c.T12);
        setValue(maxPerMonthPM, c.T13);

        setValue(setAvgAM, c.U12);
        setValue(setAvgPM, c.U13);

        setValue(shift1Start, c.T15);
        setValue(shift1End,   c.U15);
        setValue(shift2Start, c.T16);
        setValue(shift2End,   c.U16);
        setValue(shift3Start, c.T17);
        setValue(shift3End,   c.U17);

        if (showTop) topStatus("");
      } catch (err) {
        topStatus(String(err?.message || err));
      }
    }

    // ===== SAVE (debounced) =====
    function debounce(fn, ms) {
      let t = null;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
      };
    }

    function doSaveCell(a1, value) {
      const v = (value == null) ? "" : String(value);

      showSave("Saving...");
      return apiPost({ mode: "updateCell", a1, value: v })
        .then(() => loadCounters(false))     // ✅ no top loading during save
        .then(() => showSavedThenHide(700));
    }

    // ✅ Longer delay for typing (so you can finish typing)
    const saveCellTyping = debounce((a1, value) => {
      doSaveCell(a1, value).catch((err) => {
        topStatus(String(err?.message || err));
        showSave("Failed");
        setTimeout(hideSave, 900);
      });
    }, 1200);

    // ✅ Short delay for dropdown/time (feels instant)
    const saveCellFast = debounce((a1, value) => {
      doSaveCell(a1, value).catch((err) => {
        topStatus(String(err?.message || err));
        showSave("Failed");
        setTimeout(hideSave, 900);
      });
    }, 250);

    // ===== Slots: Clamp slot inputs to 0–3 only =====
    function bindSlotInput(inputEl, a1) {
      if (!inputEl) return;

      // prevent typing e, +, -, .
      inputEl.addEventListener("keydown", (e) => {
        if (["e", "E", "+", "-", "."].includes(e.key)) {
          e.preventDefault();
        }
      });

      inputEl.addEventListener("input", () => {
        let val = parseInt(inputEl.value, 10);

        if (isNaN(val)) {
          inputEl.value = "";
          return;
        }

        if (val < 0) val = 0;
        if (val > 3) val = 3;

        inputEl.value = val;                 // snap UI
        saveCellTyping(a1, String(val));     // save clamped value only (with delay)
      });
    }

    // ===== EDITABLES: on edit -> write back =====
    openMonth?.addEventListener("change", () => {
      saveCellFast("COUNTER!R4", String(openMonth.value || "").toUpperCase().trim());
    });

    bindSlotInput(slotsShift1, "COUNTER!R6");
    bindSlotInput(slotsShift2, "COUNTER!S6");
    bindSlotInput(slotsShift3, "COUNTER!T6");

    maxPerMonthAM?.addEventListener("input", () => saveCellTyping("COUNTER!T12", maxPerMonthAM.value));
    maxPerMonthPM?.addEventListener("input", () => saveCellTyping("COUNTER!T13", maxPerMonthPM.value));

 	function bindWholeNumberInput(inputEl, a1) {
  	if (!inputEl) return;

  	// block e, +, -, ., etc
  	inputEl.addEventListener("keydown", (e) => {
    if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
  	});

  	inputEl.addEventListener("input", () => {
    // keep digits only
    const digitsOnly = String(inputEl.value || "").replace(/[^\d]/g, "");
    inputEl.value = digitsOnly;

    if (digitsOnly === "") return; // allow clearing while typing

    // whole number
    const n = parseInt(digitsOnly, 10);
    if (Number.isNaN(n)) return;

    saveCellTyping(a1, String(n));
  	});
	}

	bindWholeNumberInput(setAvgAM, "COUNTER!U12");
	bindWholeNumberInput(setAvgPM, "COUNTER!U13");


    shift1Start?.addEventListener("change", () => saveCellFast("COUNTER!T15", shift1Start.value));
    shift1End?.addEventListener("change",   () => saveCellFast("COUNTER!U15", shift1End.value));

    shift2Start?.addEventListener("change", () => saveCellFast("COUNTER!T16", shift2Start.value));
    shift2End?.addEventListener("change",   () => saveCellFast("COUNTER!U16", shift2End.value));

    shift3Start?.addEventListener("change", () => saveCellFast("COUNTER!T17", shift3Start.value));
    shift3End?.addEventListener("change",   () => saveCellFast("COUNTER!U17", shift3End.value));

    // ===== INIT =====
    closeMenu();
    closeModal();
    topStatus("");
    loadCounters(true);
  });
})();
