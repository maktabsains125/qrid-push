/* my-schedule.js (UID version — Gate+Shift layout)
 * - Waits briefly for auth.js to hydrate session before redirecting
 * - Uses UID (from session) instead of teacher code when calling backend
 * - Booking strings now include gate, e.g.:
 *     "SHIFT 2 - 20 JAN - TUE - GATE A"
 * - Totals show SHIFT 1/2/3 time ranges (from backend slotTimes)
 */

(function () {
  "use strict";

  // ===== DOM =====
  const closeBtn   = document.getElementById("closeBtn");
  const kebabBtn   = document.getElementById("kebabBtn");
  const overlay    = document.getElementById("overlay");
  const overlayDim = document.getElementById("overlayDim");
  const panelClose = document.getElementById("panelClose");

  const goBook  = document.getElementById("goBook");
  const goMe    = document.getElementById("goMe");
  const goAdmin = document.getElementById("goAdmin");

  const msgText = document.getElementById("msgText");
  const dotsEl  = document.getElementById("dots");
  const gridEl  = document.getElementById("schedGrid");

  const totBookings = document.getElementById("totBookings");
  const totTarget   = document.getElementById("totTarget");

  // (kept ids unchanged in HTML)
  const amS1 = document.getElementById("amS1");
  const amS2 = document.getElementById("amS2");
  const pmS  = document.getElementById("pmS");

  const subTitle = document.getElementById("subTitle");
  const timeRangeEl = document.getElementById("timeRange"); // optional (your HTML doesn’t include it; safe)

  // ===== Routes =====
  const ROUTE_CAMERA = "/shared/camera/index.html";
  const ROUTE_BOOK   = "/shared/camera/greetings/bookings.html";
  const ROUTE_ME     = "/shared/camera/schedule/my-schedule.html";
  const ROUTE_ADMIN  = "/shared/camera/admin/admin-book.html";

  function go(url) { if (!url) return; window.location.assign(url); }

  // ===== Status with stable dots =====
  let dotTimer = null;
  function stopDots() { if (dotTimer) clearInterval(dotTimer); dotTimer = null; }
  function startDots() {
    stopDots();
    if (!dotsEl) return;
    const states = [".", "..", "..."];
    let i = 2;
    dotsEl.textContent = states[i];
    dotTimer = setInterval(() => {
      i = (i + 1) % states.length;
      dotsEl.textContent = states[i];
    }, 550);
  }

  function setStatus(text, isLoading) {
    if (msgText) msgText.textContent = text || "";
    if (!dotsEl) return;

    if (!text) { stopDots(); dotsEl.textContent = ""; return; }
    if (isLoading) startDots();
    else { stopDots(); dotsEl.textContent = "..."; }
  }

  // ===== Menu open/close =====
  let menuOpen = false;
  function openMenu() { if (!overlay) return; overlay.hidden = false; menuOpen = true; }
  function closeMenu(){ if (!overlay) return; overlay.hidden = true;  menuOpen = false; }

  // ===== Auth hydration wait =====
  function safeWho() {
    try {
      if (window.Auth && typeof Auth.who === "function") return Auth.who() || null;
    } catch (_) {}
    return null;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitForWho(maxMs = 1200, stepMs = 80) {
    const t0 = Date.now();
    let w = safeWho();
    if (w) return w;

    while (Date.now() - t0 < maxMs) {
      await sleep(stepMs);
      w = safeWho();
      if (w) return w;
    }
    return null;
  }

  // ===== Helpers =====
  function isAdminish(role) {
    return role === "ADMIN" || role === "CODER";
  }

  function monthOrder() {
    return ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV"];
  }

  function renderGrid(monthMap) {
    if (!gridEl) return;
    gridEl.innerHTML = "";
    const months = monthOrder();

    for (const m of months) {
      const mCell = document.createElement("div");
      mCell.className = "monthCell";
      mCell.textContent = m;
      gridEl.appendChild(mCell);

      const items = Array.isArray(monthMap && monthMap[m]) ? monthMap[m] : [];
      for (let c = 0; c < 3; c++) {
        const d = items[c] || "";
        const cell = document.createElement("div");
        cell.className = "dateCell" + (d ? "" : " isEmpty");
        cell.textContent = d;
        gridEl.appendChild(cell);
      }
    }
  }

  function setTimeRange(data, role) {
    // Your HTML currently doesn’t have #timeRange; this is optional and safely no-ops.
    if (!timeRangeEl) return;

    if (isAdminish(role)) {
      timeRangeEl.textContent = "";
      timeRangeEl.style.display = "none";
      return;
    }

    const session = String(data && data.session ? data.session : "").toUpperCase().trim();
    const st = data && data.slotTimes && typeof data.slotTimes === "object" ? data.slotTimes : null;

    let text = "";
    if (st) {
      if (session === "AM") {
        const a1 = String(st.shift1 || "").trim();
        const a2 = String(st.shift2 || "").trim();
        const parts = [];
        if (a1) parts.push(`SHIFT 1: ${a1}`);
        if (a2) parts.push(`SHIFT 2: ${a2}`);
        text = parts.join(" • ");
      } else if (session === "PM") {
        const p = String(st.shift3 || "").trim();
        if (p) text = `SHIFT 3: ${p}`;
      }
    }

    if (!text) {
      timeRangeEl.textContent = "";
      timeRangeEl.style.display = "none";
      return;
    }

    timeRangeEl.textContent = text;
    timeRangeEl.style.display = "";
  }

  function setTotals(data) {
    const total = Number(data && data.totalBookings != null ? data.totalBookings : 0);
    if (totBookings) totBookings.textContent = `Total of bookings made: ${total}`;

    const target = (data && data.targetTotal != null && data.targetTotal !== "") ? data.targetTotal : "-";
    if (totTarget) totTarget.textContent = `Target total of bookings: ${target}`;

    // Prefer backend slotTimes (strings)
    const st = (data && data.slotTimes && typeof data.slotTimes === "object") ? data.slotTimes : null;
    if (st) {
      if (amS1) amS1.textContent = `SHIFT 1: ${String(st.shift1 || "-")}`;
      if (amS2) amS2.textContent = `SHIFT 2: ${String(st.shift2 || "-")}`;
      if (pmS)  pmS.textContent  = `SHIFT 3: ${String(st.shift3 || "-")}`;
      return;
    }

    // fallback (rare)
    if (amS1) amS1.textContent = `SHIFT 1: -`;
    if (amS2) amS2.textContent = `SHIFT 2: -`;
    if (pmS)  pmS.textContent  = `SHIFT 3: -`;
  }

  function setSubheading(code, session, role) {
    if (!subTitle) return;

    if (isAdminish(role)) {
      subTitle.textContent = "";
      subTitle.style.display = "none";
      return;
    }

    if (!code) {
      subTitle.textContent = "";
      subTitle.style.display = "none";
      return;
    }

    const sess = (session === "PM") ? "PM SESSION" : (session === "AM" ? "AM SESSION" : "");
    subTitle.textContent = sess ? `${code} (${sess})` : code;
    subTitle.style.display = "";
  }

  // ===== Events =====
  closeBtn?.addEventListener("click", () => go(ROUTE_CAMERA));

  kebabBtn?.addEventListener("click", openMenu);
  overlayDim?.addEventListener("click", closeMenu);
  panelClose?.addEventListener("click", closeMenu);

  goBook?.addEventListener("click", () => go(ROUTE_BOOK));
  goMe?.addEventListener("click", () => go(ROUTE_ME));
  goAdmin?.addEventListener("click", () => go(ROUTE_ADMIN));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (menuOpen) closeMenu();
      else go(ROUTE_CAMERA);
    }
  });

  // ===== Load schedule (UID version) =====
  async function load(who) {
    const role = String(who.role || "").toUpperCase().trim();

    // Hide Admin button for non-adminish
    if (!isAdminish(role) && goAdmin) goAdmin.style.display = "none";

    // display only
    const code = String(
      who.code ||
      who.teacher ||
      who.id ||
      who.teacherCode ||
      who.user ||
      who.username ||
      ""
    ).toUpperCase().trim();

    // UID from session
    const sessObj = (window.Auth && typeof Auth.load === "function") ? (Auth.load() || {}) : {};
    const uid = String(who.uid || sessObj.uid || "").trim();

    try {
      setStatus("Loading. Please wait", true);

      if (!uid) {
        setStatus("Missing UID in session. Please log in again.", false);
        renderGrid({});
        setTotals({ totalBookings: 0, targetTotal: "-", slotTimes: {} });
        setSubheading(code, "", role);
        setTimeRange(null, role);
        return;
      }

      const res = await fetch("/.netlify/functions/my-schedule-netlify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "getMySchedule", uid }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.ok !== true) {
        const errMsg = (data && data.error) ? data.error : `Failed to load schedule (${res.status})`;
        throw new Error(errMsg);
      }

      renderGrid(data.months || {});
      setTotals(data);

      const sess = String(data.session || "").toUpperCase().trim();
      const displayCode = String(data.code || code || "").toUpperCase().trim();

      setSubheading(displayCode, sess, role);
      setTimeRange(data, role);

      setStatus("", false);
    } catch (err) {
      console.error(err);
      setStatus(String(err && err.message ? err.message : err), false);
      renderGrid({});
      setTotals({ totalBookings: 0, targetTotal: "-", slotTimes: {} });
      setSubheading(code, "", role);
      setTimeRange(null, role);
    }
  }

  // ===== Boot =====
  (async function boot() {
    setStatus("Loading. Please wait", true);

    const who = await waitForWho(1400, 80);
    if (!who) {
      window.location.replace("/");
      return;
    }

    await load(who);
  })();

})();
