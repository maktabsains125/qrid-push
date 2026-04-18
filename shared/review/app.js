/* /shared/review/app.js — localStorage-only (ANCHOR version)
   + Verify checkbox lock:
     - Disabled daily from 3:00 PM → 7:00 AM next day (Brunei time)
     - Disabled all day Friday + Sunday (Brunei time)
     - Adds a disabled look by toggling .isLocked on #verifyLbl

   Requires localStorage (new):
     - ms_anchor  : anchor string (e.g. "A6", "A42", "A78") OR "6"/"42"/"78"
     - ms_level   : e.g. "10"
     - ms_class   : e.g. "C"
     - ms_user_code (optional; "ft" by default)

   Notes:
     - Calls session.start(user, clazz, anchor)
     - E column (col 5) is free text;
       F..AB enforce codes 1 / M / L / P / N / X / 0 (backend-enforced)
     - Row 1 is hidden in UI
     - Save button flushes pending edits and refreshes the grid
*/

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // ===== ROLE + FT HARD-LOCK =====
  const role = String(who.role || "").toUpperCase().trim();
  const ftInfo = (window.Auth && Auth.ft && Auth.ft()) ? Auth.ft() : null;

  if (role === "FT") {
    // For FTs, DO NOT trust URL or pre-existing localStorage.
    // Requires ftInfo.anchor (NOT reviewid)
    if (!ftInfo || !ftInfo.level || !ftInfo.class || !ftInfo.anchor) {
      alert("Your form teacher class is not configured. Please contact the admin.");
      window.location.replace("/");
      return;
    }

    const lvl    = String(ftInfo.level || "").trim();
    const klas   = String(ftInfo.class || "").trim();
    const clazz  = `${lvl}${klas}`.trim();
    const anchor = String(ftInfo.anchor || "").trim();

    // Force localStorage to the FT's OWN mapping
    localStorage.setItem("ms_level", lvl);
    localStorage.setItem("ms_class", klas);
    localStorage.setItem("ms_anchor", anchor);
    localStorage.setItem(
      "ms_user_code",
      (who.code ? String(who.code) : "ft").trim().toLowerCase()
    );

    console.log("[dailyreview] FT hard-locked to", { level: lvl, class: klas, clazz, anchor });
  }

  // ===== CONFIG =====
  const REVIEW_WEBAPP_URL = "/.netlify/functions/dailyreview";

  // ===== DOM =====
  const $ = (s, root = document) => root.querySelector(s);

  // Mast / headings / status
  const reviewHeader  = $("#reviewHeader");
  const remarksHeader = $("#remarksHeader");
  const reviewStatus  = $("#reviewStatus");
  const remarksStatus = $("#remarksStatus");
  const closeBtn      = $("#closeBtn");

  // Tabs
  const tabReview = $("#tabReview");
  const tabReason = $("#tabReason");

  // Review (grid)
  const reviewCard  = $("#reviewCard");
  const tableWrap   = $("#tableWrap");
  const classLabel  = $("#classLabel");
  const monthSpan   = $("#monthSpan");
  const verifyChk   = $("#verifyChk");
  const verifyLbl   = $("#verifyLbl");
  const saveBtn     = $("#saveBtn");
  const refreshBtn  = $("#refreshBtn");

  // Reasons
  const remarksCard = $("#remarksCard");
  const remarksBody = $("#remarksBody");
  const remarksMsg  = $("#remarksMsg");

  // Small helpers
  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");
  const setText = (el, t) => el && (el.textContent = t || "");
  const dots = (el, base) =>
    el && (el.innerHTML = `${base} <span class="dots"></span>`);

  function niceToday(d = new Date()) {
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function todayDdMm() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  }

  // ===== Brunei time helpers (Asia/Brunei) =====
  const BRUNEI_TZ = "Asia/Brunei";
  let VERIFY_LOCKED = false;

  function getBruneiNowParts() {
    const dtf = new Intl.DateTimeFormat("en-GB", {
      timeZone: BRUNEI_TZ,
      hour12: false,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = dtf.formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;

    const weekdayStr = get("weekday");
    const hh = Number(get("hour") || 0);
    const mm = Number(get("minute") || 0);

    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = map[weekdayStr] ?? null;

    return { dow, hh, mm };
  }

  function isVerifyLockedNow() {
    const p = getBruneiNowParts();
    if (!p || p.dow == null) return false;

    // Disabled all day Friday (5) and Sunday (0)
    if (p.dow === 5 || p.dow === 0) return true;

    // Disabled daily from 15:00 to 07:00 next day
    const minutes = p.hh * 60 + p.mm;
    const from3pm = 15 * 60;
    const to7am = 7 * 60;

    return minutes >= from3pm || minutes < to7am;
  }

  function applyVerifyLock() {
    VERIFY_LOCKED = isVerifyLockedNow();

    if (verifyChk) verifyChk.disabled = VERIFY_LOCKED;

    if (verifyLbl) {
      verifyLbl.classList.toggle("isLocked", VERIFY_LOCKED);
      verifyLbl.setAttribute("aria-disabled", VERIFY_LOCKED ? "true" : "false");
      verifyLbl.title = VERIFY_LOCKED
        ? "Verify is locked (Fri/Sun all day, and 3pm–7am Brunei time)."
        : "";
    }
  }

  // ===== Navigation (close/X button) =====
  closeBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.assign("/roles/form-teacher/");
  });

  // ===== POST helper — send JSON as text/plain (no CORS preflight) =====
  async function post(path, payload) {
    const res = await fetch(REVIEW_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ path }, payload || {})),
    });

    const txt = await res.text();
    let data = null;
    try {
      data = JSON.parse(txt);
    } catch {
      throw new Error("Server returned bad JSON");
    }
    if (!data.ok) throw new Error(data.error || "Server error");
    return data;
  }

  // ===== State =====
  let TOKEN = null;

  function normalizeAnchor(a) {
    const s = String(a || "").trim().toUpperCase();
    if (!s) return "";
    if (/^A\d+$/.test(s)) return s;     // "A78"
    if (/^\d+$/.test(s)) return "A" + s; // "78" -> "A78"
    return ""; // invalid
  }

  // ===== Start =====
  async function start() {
    const rawAnchor = (localStorage.getItem("ms_anchor") || "").trim();
    const anchor = normalizeAnchor(rawAnchor);

    const level = (localStorage.getItem("ms_level") || "").trim();
    const klass = (localStorage.getItem("ms_class") || "").trim();
    const user = (localStorage.getItem("ms_user_code") || "ft").trim().toLowerCase();
    const clazz = (level + klass).trim();

    if (!anchor || !clazz) {
      alert("Missing class/anchor configuration. Please contact admin.");
      return;
    }

    setText(classLabel, `Class: ${clazz}`);
    setText(monthSpan, niceToday());
    show(reviewHeader);
    show(reviewCard);

    dots(reviewStatus, "Loading. Please wait");
    show(reviewStatus);

    // ✅ NEW CONTRACT: session.start(user, clazz, anchor)
    const data = await post("session.start", { user, clazz, anchor });
    TOKEN = data.token;

    const grid = {
      data: (data.grid && data.grid.data) || [],
      formats: (data.grid && data.grid.formats) || {},
      allowed: (data.grid && data.grid.allowed) || [],
      clazz,
    };

    renderGrid(grid);

    if (verifyChk) verifyChk.checked = !!(data.verify && data.verify.value);

    applyVerifyLock();
    setInterval(applyVerifyLock, 30 * 1000);

    hide(reviewStatus);
  }

  // ===== Render grid =====
  function renderGrid(out) {
    const data = out.data || [];
    const fRed = (out.formats && out.formats.fRed) || [];

    const tbl = document.createElement("table");

    // Today's column index based on header row 4 (r=3), F..AB (c=5..27)
    const todayKey = todayDdMm();
    let todayColIndex = -1;

    if (data.length >= 4) {
      const hdr = data[3];
      for (let c = 5; c <= 27; c++) {
        const v = hdr && hdr[c];
        if (typeof v === "string" && v.trim() === todayKey) {
          todayColIndex = c;
          break;
        }
      }
    }

    // last date col (so unused future columns can hide)
    let lastDateColIndex = -1;
    if (data.length >= 4) {
      const hdr = data[3];
      for (let c = 27; c >= 5; c--) {
        const v = hdr && hdr[c];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          lastDateColIndex = c;
          break;
        }
      }
    }

    const visibleCols = [];
    const colCount = data.length > 0 ? data[0].length : 0;

    for (let c = 0; c < colCount; c++) {
      if (c <= 4) { visibleCols.push(c); continue; } // A..E always
      if (c >= 5 && c <= 27) {                       // F..AB only until last date
        if (lastDateColIndex >= 5 && c <= lastDateColIndex) visibleCols.push(c);
        continue;
      }
      visibleCols.push(c); // AC..AD etc always visible
    }

    for (let r = 0; r < data.length; r++) {
      if (r === 0) continue; // hide row 1

      const row = data[r];
      const sheetRow = r + 1;

      // Hide rows where C7:C40 is empty
      if (sheetRow >= 7 && sheetRow <= 40) {
        const nameVal = row[2];
        const isEmpty = nameVal == null || String(nameVal).trim() === "";
        if (isEmpty) continue;
      }

      const tr = document.createElement("tr");

      for (const c of visibleCols) {
        const td = document.createElement("td");
        const div = document.createElement("div");
        div.className = "clip";

        if (c === 28) td.classList.add("colTotal");
        if (c === 29) td.classList.add("colTotalPct");
        if (c === 1) td.classList.add("nameCol");

        // Format last column numbers to 2dp
        if (c === row.length - 1 && row[c] != null && row[c] !== "" && !isNaN(Number(row[c]))) {
          div.textContent = Number(row[c]).toFixed(2);
        } else {
          div.textContent = row[c] == null ? "" : row[c];
        }

        // AC4 & AD4 header labels
        if (r === 3 && (c === 28 || c === 29)) {
          div.textContent = (c === 28 ? "Total" : "Total %");
          td.classList.add("totalHdr");
        }

        // Sticky columns + sticky row 4
        if (c === 0) td.classList.add("c0");
        if (c === 4) td.classList.add("c4");
        if (r === 3) td.classList.add("r4");

        // Highlight today's column for rows 6..40
        if (todayColIndex >= 0 && c === todayColIndex && sheetRow >= 6 && sheetRow <= 40) {
          td.style.backgroundColor = "#FFFDCA";
        }

        // Editable window: E..AB (0-based 4..27); rows 6..40 (0-based r 5..39)
        const inEditableCols = c >= 4 && c <= 27;
        const inEditableRows = r >= 5 && r <= 39;

        if (inEditableCols && inEditableRows) {
          td.classList.add("editable");
          div.contentEditable = "true";

          div.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              div.blur();
            }
          });

          // Uppercase for F..AB only (E stays free text)
          div.addEventListener("input", () => {
            if (c !== 4) {
              const sel = window.getSelection();
              const keepEnd = document.createRange();
              div.textContent = div.textContent.toUpperCase();
              keepEnd.selectNodeContents(div);
              keepEnd.collapse(false);
              sel.removeAllRanges();
              sel.addRange(keepEnd);
            }
          });

          div.addEventListener("blur", () => {
            const raw = div.textContent.trim();
            const value = c === 4 ? raw : raw.toUpperCase();
            queueEdit(r + 1, c + 1, value); // backend uses 1-based coords
          });
        }

        // Red-ish font for flagged F6:F40 (c=5, r=5..39)
        if (c === 5 && r >= 5 && r <= 39) {
          const idx = r - 5;
          if (fRed[idx]) div.style.color = "#EA4335";
        }

        td.appendChild(div);
        tr.appendChild(td);
      }

      tbl.appendChild(tr);
    }

    tableWrap.innerHTML = "";
    tableWrap.appendChild(tbl);
  }

  // ===== Buffered edits + Save button =====
  let pending = [];
  let sending = false;
  let flushTimer = 0;

  function queueEdit(row, col, value) {
    pending.push({ row, col, value });
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushEdits, 250);
  }

  async function flushEdits() {
    if (sending || pending.length === 0) return;

    const edits = pending.slice();
    pending = [];
    sending = true;

    dots(reviewStatus, "Saving");
    show(reviewStatus);

    try {
      const r = await post("grid.update", { token: TOKEN, edits });
      setText(reviewStatus, `Saved (${r.updated})`);
    } catch (err) {
      console.error(err);
      setText(reviewStatus, "Save failed");
    } finally {
      sending = false;
      setTimeout(() => hide(reviewStatus), 1000);
    }
  }

  // ===== Save + refresh grid =====
  saveBtn?.addEventListener("click", async () => {
    try {
      dots(reviewStatus, "Saving");
      show(reviewStatus);

      await flushEdits();

      const out = await post("grid.fetch", { token: TOKEN });
      renderGrid(out);

      setText(reviewStatus, "Saved");
      setTimeout(() => hide(reviewStatus), 1000);
    } catch (err) {
      alert(err.message || String(err));
      hide(reviewStatus);
    }
  });

  // ===== Refresh button =====
  refreshBtn?.addEventListener("click", async () => {
    try {
      dots(reviewStatus, "Loading. Please wait");
      show(reviewStatus);

      await flushEdits();

      const out = await post("grid.fetch", { token: TOKEN });
      renderGrid(out);

      setText(reviewStatus, "Refreshed");
      setTimeout(() => hide(reviewStatus), 800);
    } catch (err) {
      alert(err.message || String(err));
      hide(reviewStatus);
    }
  });

  // ===== Verify checkbox =====
  verifyChk?.addEventListener("change", async () => {
    applyVerifyLock();
    if (VERIFY_LOCKED) {
      await syncVerify().catch(() => {});
      return;
    }

    try {
      await post("verify.set", { token: TOKEN, value: !!verifyChk.checked });
    } catch (err) {
      console.error(err);
      alert("Failed to set verify flag: " + (err.message || err));
      await syncVerify().catch(() => {});
    }
  });

  async function syncVerify() {
    try {
      const r = await post("verify.get", { token: TOKEN });
      if (verifyChk) verifyChk.checked = !!r.value;
      applyVerifyLock();
    } catch (err) {
      console.warn("verify.get failed", err);
    }
  }

  // ===== Reasons loading + inline save =====
  async function loadRemarks() {
    dots(remarksStatus, "Loading. Please wait");
    show(remarksStatus);
    const r = await post("remarks.fetch", { token: TOKEN });
    renderRemarks(r.data || []);
    hide(remarksStatus);
  }

  function renderRemarks(rows) {
    remarksBody.innerHTML = "";
    for (let i = 0; i < rows.length; i++) {
      const tr = document.createElement("tr");

      const c0 = document.createElement("td");
      const d0 = document.createElement("div");
      d0.className = "rclip";
      d0.textContent = rows[i][0] || "";
      c0.appendChild(d0);

      const c1 = document.createElement("td");
      const d1 = document.createElement("div");
      d1.className = "rclip";
      d1.textContent = rows[i][1] || "";
      c1.appendChild(d1);

      const c2 = document.createElement("td");
      c2.className = "editable col2";
      const d2 = document.createElement("div");
      d2.className = "rclip";
      d2.textContent = rows[i][2] || "";
      d2.contentEditable = "true";

      d2.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          d2.blur();
        }
      });

      d2.addEventListener("blur", async () => {
        const value = d2.textContent.trim();
        try {
          const r = await post("remarks.update", {
            token: TOKEN,
            rows: [{ rowOffset: i, value }],
          });
          setText(remarksMsg, `Saved (${r.updated})`);
        } catch (err) {
          console.error(err);
          setText(remarksMsg, "Save failed");
        } finally {
          setTimeout(() => setText(remarksMsg, ""), 1200);
        }
      });

      c2.appendChild(d2);

      tr.appendChild(c0);
      tr.appendChild(c1);
      tr.appendChild(c2);
      remarksBody.appendChild(tr);
    }
  }

  // ===== Tabs (Review | Reason) =====
  function selectTab(which) {
    const isReview = which === "review";

    tabReview?.setAttribute("aria-selected", String(isReview));
    tabReason?.setAttribute("aria-selected", String(!isReview));

    if (isReview) {
      show(reviewHeader);
      hide(remarksHeader);
    } else {
      hide(reviewHeader);
      show(remarksHeader);
    }

    if (isReview) {
      show(reviewCard);
      hide(remarksCard);
    } else {
      hide(reviewCard);
      show(remarksCard);
      loadRemarks().catch(console.error);
    }
  }

  tabReview?.addEventListener("click", () => selectTab("review"));
  tabReason?.addEventListener("click", () => selectTab("reason"));

  // ===== Boot =====
  window.addEventListener("DOMContentLoaded", () => {
    start().catch((err) => {
      console.error(err);
      alert(err.message || String(err));
    });
  });
})();
