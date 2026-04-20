(() => {
  "use strict";

  // ===== Require login (auth hydration safety) =====
  function safeWho() {
    try {
      if (window.Auth && typeof Auth.who === "function") return Auth.who() || null;
    } catch (_) {}
    return null;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

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

  // ===== Routes =====
  const ROUTE_CAMERA = "/shared/camera/index.html";
  const ROUTE_BOOK   = "/shared/camera/greetings/bookings.html";
  const ROUTE_ME     = "/shared/camera/schedule/my-schedule.html";
  const ROUTE_ADMIN  = "/shared/camera/admin/admin-book.html";

  function go(url) {
    if (url) window.location.assign(url);
  }

  // ===== API =====
  const API = "/.netlify/functions/bookings-netlify";
  const PUSH_API = "/.netlify/functions/push-subscribe";

  // ===== DOM =====
  const pageTitle = document.getElementById("pageTitle");
  const xBtn = document.getElementById("xBtn");

  const kebabBtn = document.getElementById("kebabBtn");
  const overlay = document.getElementById("overlay");
  const overlayDim = document.getElementById("overlayDim");
  const panelCloseBtn = document.getElementById("panelCloseBtn");

  const goBookGreetings = document.getElementById("goBookGreetings");
  const goMySchedule = document.getElementById("goMySchedule");
  const goAdmin = document.getElementById("goAdmin");

  const monthBox = document.getElementById("monthBox");
  const monthText = document.getElementById("monthText");
  const monthMenu = document.getElementById("monthMenu");

  const weekPrev = document.getElementById("weekPrev");
  const weekNext = document.getElementById("weekNext");
  const weekPill = document.getElementById("weekPill");

  const statusMsg = document.getElementById("statusMsg");
  const calGrid = document.getElementById("calGrid");

  const adminBar = document.getElementById("adminBar");
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");

  const tShift1 = document.getElementById("tShift1");
  const tShift2 = document.getElementById("tShift2");
  const tShift3 = document.getElementById("tShift3");

  const popup = document.getElementById("popup");
  const popupX = document.getElementById("popupX");
  const popupMsg = document.getElementById("popupMsg");

  const saveOverlay = document.getElementById("saveOverlay");
  const saveCardText = document.getElementById("saveCardText");

  // ===== Booking gate toggle =====
  const bookingGateBar = document.getElementById("bookingGateBar");
  const bookingGateToggle = document.getElementById("bookingGateToggle");
  const bookingGateText = document.getElementById("bookingGateText");

  const pushCard = document.getElementById("pushCard");
  const pushCardText = document.getElementById("pushCardText");
  const pushEnableBtn = document.getElementById("pushEnableBtn");
  const pushLaterBtn = document.getElementById("pushLaterBtn");

  // ===== Constants =====
  const MONTHS = [
    { key: "JAN", label: "JANUARY", num: 1 },
    { key: "FEB", label: "FEBRUARY", num: 2 },
    { key: "MAR", label: "MARCH", num: 3 },
    { key: "APR", label: "APRIL", num: 4 },
    { key: "MAY", label: "MAY", num: 5 },
    { key: "JUN", label: "JUNE", num: 6 },
    { key: "JUL", label: "JULY", num: 7 },
    { key: "AUG", label: "AUGUST", num: 8 },
    { key: "SEP", label: "SEPTEMBER", num: 9 },
    { key: "OCT", label: "OCTOBER", num: 10 },
    { key: "NOV", label: "NOVEMBER", num: 11 },
  ];

  const SLOT_MAP = {
    A: { 1: ["C","D","E"], 2: ["F","G","H"], 3: ["I","J","K"] },
    B: { 1: ["L","M","N"], 2: ["O","P","Q"], 3: ["R","S","T"] },
    C: { 1: ["U","V","W"], 2: ["X","Y","Z"], 3: ["AA","AB","AC"] },
  };

  // ===== Push notifications =====
  const PUSH_PUBLIC_KEY = "BIjJvyTjSAwpqPNrMiczDwHUQ8T0v_-ITLvPPMTTPv-mq9Eg0Q79kaJkCFqK1vxmoMOjovQ3GNasnPwYKbWqIvo";
  const PUSH_SW_URL = "/sw.js";
  const PUSH_LINK_KEY_PREFIX = "greet_push_linked_";

  // ===== State =====
  let who = null;
  let role = "";
  let userCode = "";
  let isAdmin = false;

  let init = null;
  let bookingGate = 0; // 0=open, 1=closed
  let currentMonth = "JAN";
  let slotCounts = { s1: 1, s2: 1, s3: 1 };
  let monthRows = [];
  let shownRows = [];

  let editMode = false;
  const dirty = new Map();
  let autosaveTimer = null;

  let selectedWeek = 1;
  let maxWeeks = 1;

  // ===== Helpers =====
  function setStatus(t) {
    statusMsg.textContent = t || "";
  }

  function showPopup(msg) {
    popupMsg.textContent = msg || "";
    popup.hidden = false;
  }

  function hidePopup() {
    popup.hidden = true;
  }

  function showCenter(text) {
    saveCardText.textContent = text || "";
    saveOverlay.hidden = false;
  }

  function hideCenter() {
    saveOverlay.hidden = true;
  }

  function openOverlay() {
    overlay.hidden = false;
  }

  function closeOverlay() {
    overlay.hidden = true;
  }

  function monthLabel(key) {
    const m = MONTHS.find(x => x.key === key);
    return m ? m.label : key;
  }

  function monthNum(key) {
    const m = MONTHS.find(x => x.key === key);
    return m ? m.num : 1;
  }

  function bruneiNow() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Brunei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const get = (type) => parts.find(p => p.type === type)?.value || "";
    return {
      y: Number(get("year")),
      m: Number(get("month")),
      d: Number(get("day"))
    };
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDayMonth(dayNumber) {
    const d = Number(dayNumber);
    const m = monthNum(currentMonth);
    if (!Number.isFinite(d) || d <= 0) return "--/--";
    return `${pad2(d)}/${pad2(m)}`;
  }

  function isAdminRole(r) {
    const rr = String(r || "").trim().toUpperCase();
    return rr === "ADMIN" || rr === "CODER";
  }

  function getUserDisplayCode(sess) {
    return String(sess?.code || sess?.uid || "").trim().toUpperCase();
  }

  function getPushLinkKey() {
    return `${PUSH_LINK_KEY_PREFIX}${userCode || ""}`;
  }

  function clearLocalPushLinked() {
    try {
      localStorage.removeItem(getPushLinkKey());
    } catch (_) {}
  }

  function setLocalPushLinked() {
    try {
      localStorage.setItem(getPushLinkKey(), "1");
    } catch (_) {}
  }

  async function apiGet(params) {
    const url = `${API}?${new URLSearchParams(params).toString()}`;
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Bad JSON");
    }

    if (!data.ok) throw new Error(data.error || "Server error");
    return data;
  }

  async function apiPost(payload) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });

    const text = await res.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Bad JSON");
    }

    if (!data.ok) throw new Error(data.error || "Server error");
    return data;
  }

  function attachDoubleTap(el, fn) {
    let last = 0;
    el.addEventListener("click", () => {
      const now = Date.now();
      if (now - last < 420) {
        last = 0;
        fn();
      } else {
        last = now;
      }
    }, { passive: true });
  }

  function setBookingGateVisibility() {
    if (!bookingGateBar) return;
    bookingGateBar.hidden = !isAdmin;
    bookingGateBar.style.display = isAdmin ? "" : "none";
  }

  function applyBookingGateUI() {
    setBookingGateVisibility();

    if (bookingGateToggle && bookingGateText) {
      if (bookingGate === 0) {
        bookingGateToggle.classList.add("is-on");
        bookingGateToggle.setAttribute("aria-pressed", "true");
        bookingGateText.textContent = "YES";
      } else {
        bookingGateToggle.classList.remove("is-on");
        bookingGateToggle.setAttribute("aria-pressed", "false");
        bookingGateText.textContent = "NO";
      }
    }

    if (editMode) {
      setStatus("Edit mode");
      return;
    }

    if (bookingGate === 1 && !isAdmin) {
      setStatus("Bookings are closed");
    } else {
      setStatus("Tap twice to book or unbook.");
    }
  }

  // ===== Push notification helpers =====
  function isIosLike() {
    const ua = navigator.userAgent || "";
    const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return /iPhone|iPad|iPod/.test(ua) || touchMac;
  }

  function isStandalonePwa() {
    return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  }

  async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service worker is not supported.");
    }
    return navigator.serviceWorker.register(PUSH_SW_URL, { scope: "/" });
  }

  async function savePushSubscription(subscription) {
    const res = await fetch(PUSH_API, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        mode: "savePushSubscription",
        code: userCode,
        subscription
      })
    });

    const text = await res.text();
    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Bad JSON from push save endpoint");
    }

    if (!res.ok || !data.ok) {
      throw new Error((data && data.error) || "Failed to save subscription");
    }

    return data;
  }

  async function checkPushSubscription() {
    const res = await fetch(PUSH_API, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        mode: "checkPushSubscription",
        code: userCode
      })
    });

    const text = await res.text();
    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, saved: false, active: false };
    }

    if (!res.ok || !data.ok) {
      return { ok: false, saved: false, active: false };
    }

    return data;
  }

  function setPushCardState({ text, buttonLabel, buttonDisabled }) {
    if (!pushCard) return;

    pushCard.hidden = false;

    if (pushCardText) {
      pushCardText.textContent = text || "";
    }

    if (pushEnableBtn) {
      pushEnableBtn.textContent = buttonLabel || "Enable notifications";
      pushEnableBtn.disabled = !!buttonDisabled;
    }
  }

  async function refreshPushCard() {
    if (!pushCard) return;

    const hasNotification = ("Notification" in window);
    const hasSW = ("serviceWorker" in navigator);
    const hasPushManager = ("PushManager" in window);

    if (isIosLike() && !isStandalonePwa()) {
      setPushCardState({
        text: "To receive notifications on iPhone/iPad, add this app to Home Screen first, then open it from Home Screen.",
        buttonLabel: "Enable notifications",
        buttonDisabled: false
      });
      return;
    }

    if (!hasNotification) {
      setPushCardState({
        text: "This phone/browser does not support notifications here. Try opening the app in Chrome or Safari, or install it to Home Screen.",
        buttonLabel: "Enable notifications",
        buttonDisabled: false
      });
      return;
    }

    if (!hasSW || !hasPushManager) {
      setPushCardState({
        text: "Notifications are not available in this browser view. Open this app in the main browser or from Home Screen.",
        buttonLabel: "Enable notifications",
        buttonDisabled: false
      });
      return;
    }

    if (Notification.permission === "denied") {
      clearLocalPushLinked();
      setPushCardState({
        text: "Notifications are blocked in browser/site settings. Please allow them there first, then return here.",
        buttonLabel: "Blocked",
        buttonDisabled: false
      });
      return;
    }

    let existingSub = null;
    try {
      const reg = await ensureServiceWorker();
      existingSub = await reg.pushManager.getSubscription();
    } catch (_) {
      existingSub = null;
    }

    let serverSaved = false;
    try {
      const check = await checkPushSubscription();
      serverSaved = !!(check && check.saved && check.active);
    } catch (_) {
      serverSaved = false;
    }

    if (!serverSaved) {
      clearLocalPushLinked();
    }

    if (Notification.permission === "granted" && existingSub && serverSaved) {
      setPushCardState({
        text: "Notifications are enabled for greeting duty reminders.",
        buttonLabel: "On",
        buttonDisabled: true
      });
      return;
    }

    if (Notification.permission === "granted" && existingSub && !serverSaved) {
      setPushCardState({
        text: "This browser is already allowed to send notifications. Simply press Enable notifications.",
        buttonLabel: "Enable notifications",
        buttonDisabled: false
      });
      return;
    }

    if (Notification.permission === "granted" && !existingSub) {
      setPushCardState({
        text: "Notifications are allowed on this device. Press Enable notifications to turn on greeting duty reminders for QR-ID.",
        buttonLabel: "Enable notifications",
        buttonDisabled: false
      });
      return;
    }

    setPushCardState({
      text: "Get a reminder on the day when there is a greeting duty.",
      buttonLabel: "Enable notifications",
      buttonDisabled: false
    });
  }

  async function enablePushNotifications() {
    if (!("Notification" in window)) {
      throw new Error("Notifications are not supported on this device/browser.");
    }

    if (isIosLike() && !isStandalonePwa()) {
      throw new Error("On iPhone/iPad, add this app to Home Screen first, then open it from Home Screen.");
    }

    if (!("serviceWorker" in navigator)) {
      throw new Error("Service worker is not supported on this device/browser.");
    }

    if (!("PushManager" in window)) {
      throw new Error("Push notifications are not available in this browser view.");
    }

    let permission = Notification.permission;

    if (permission === "denied") {
      throw new Error("Notifications were blocked before. Please enable them in browser/site settings first.");
    }

    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      throw new Error("Notification permission was not granted.");
    }

    const reg = await ensureServiceWorker();

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY)
      });
    }

    await savePushSubscription(sub.toJSON());
    setLocalPushLinked(true);

    await refreshPushCard();
    showPopup("Notifications enabled.");
  }

  // ===== Month menu =====
  function buildMonthMenu() {
    monthMenu.innerHTML = "";
    MONTHS.forEach(m => {
      const div = document.createElement("div");
      div.className = "monthItem";
      div.textContent = m.label;
      div.dataset.key = m.key;
      div.addEventListener("click", async () => {
        if (!isAdmin) return;
        closeMonthMenu();
        await loadMonth(m.key, true);
      });
      monthMenu.appendChild(div);
    });
  }

  function openMonthMenu() {
    if (!isAdmin) return;
    monthMenu.hidden = false;
    monthBox.setAttribute("aria-expanded", "true");
  }

  function closeMonthMenu() {
    monthMenu.hidden = true;
    monthBox.setAttribute("aria-expanded", "false");
  }

  // ===== Booking value helpers =====
  const ORDER = [
    "C","D","E","F","G","H","I","J","K",
    "L","M","N","O","P","Q","R","S","T",
    "U","V","W","X","Y","Z","AA","AB","AC"
  ];

  function getValueForA1_(rowObj, a1) {
    const m = String(a1).match(/^([A-Z]+)(\d+)$/);
    if (!m) return "";
    const col = m[1];
    const idx = ORDER.indexOf(col);
    if (idx < 0) return "";
    return String(rowObj.bookings?.[idx] || "").trim().toUpperCase();
  }

  function setValueForA1_(rowObj, a1, newVal) {
    const m = String(a1).match(/^([A-Z]+)(\d+)$/);
    if (!m) return;
    const col = m[1];
    const idx = ORDER.indexOf(col);
    if (idx < 0) return;
    rowObj.bookings[idx] = String(newVal || "").trim().toUpperCase();
  }

  function getA1(rowNumber, colLetters) {
    return `${colLetters}${rowNumber}`;
  }

  function getDayNumberFromRow(r) {
    const m = String(r?.date || "").trim().match(/\d+/);
    return m ? Number(m[0]) : NaN;
  }

  function isPastRow(r) {
    const today = bruneiNow();
    const dayNum = getDayNumberFromRow(r);
    if (!Number.isFinite(dayNum) || dayNum <= 0) return true;

    const targetKey = (today.y * 10000) + (monthNum(currentMonth) * 100) + dayNum;
    const todayKey  = (today.y * 10000) + (today.m * 100) + today.d;

    return targetKey < todayKey;
  }

  // ===== Week logic =====
  function computeShownRows() {
    shownRows = monthRows.filter(r => String(r.date || "").trim() !== "");

    const weeks = [];
    let wk = [];

    function pushWeek() {
      if (wk.length) weeks.push(wk);
      wk = [];
    }

    shownRows.forEach((r, idx) => {
      const day = String(r.day || "").trim().toUpperCase();

      if (idx !== 0 && day === "MON" && wk.length) {
        pushWeek();
      }

      wk.push(r);

      if (day === "SAT") {
        pushWeek();
      }
    });

    pushWeek();

    maxWeeks = Math.max(1, weeks.length);
    window._weeks = weeks;
  }

  function findCurrentWeek() {
    const today = bruneiNow();
    if (today.m !== monthNum(currentMonth)) return 1;

    const td = Number(today.d);
    const weeks = window._weeks || [];

    for (let w = 0; w < weeks.length; w++) {
      const hit = weeks[w].some(r => {
        const m = String(r.date || "").trim().match(/\d+/);
        return m && Number(m[0]) === td;
      });
      if (hit) return w + 1;
    }
    return 1;
  }

  function setWeek(w) {
    selectedWeek = Math.max(1, Math.min(maxWeeks, Number(w) || 1));
    weekPill.textContent = `WEEK ${selectedWeek}`;

    weekPrev.disabled = (selectedWeek <= 1);
    weekNext.disabled = (selectedWeek >= maxWeeks);

    weekPrev.style.visibility = (maxWeeks <= 1) ? "hidden" : "visible";
    weekNext.style.visibility = (maxWeeks <= 1) ? "hidden" : "visible";

    renderWeek();
  }

  function cycleWeek() {
    const next = selectedWeek >= maxWeeks ? 1 : (selectedWeek + 1);
    setWeek(next);
  }

  // ===== Render ONLY selected week =====
  function renderWeek() {
    calGrid.innerHTML = "";

    const gateHeaderRow = document.createElement("div");
    gateHeaderRow.className = "gateHeaderRow";

    const spacer = document.createElement("div");
    spacer.className = "gateHeaderSpacer";
    gateHeaderRow.appendChild(spacer);

    ["GATE A","GATE B","GATE C"].forEach(name => {
      const h = document.createElement("div");
      h.className = "gateHeader";
      h.textContent = name;
      gateHeaderRow.appendChild(h);
    });

    calGrid.appendChild(gateHeaderRow);

    const weeks = window._weeks || [];
    const slice = weeks[selectedWeek - 1] || [];

    slice.forEach(r => {
      const row = document.createElement("div");
      row.className = "dayRow";

      const dayTag = document.createElement("div");
      dayTag.className = "dayTag";

      const dow = String(r.day || "").trim().toUpperCase() || "---";
      const dayNumMatch = String(r.date || "").trim().match(/\d+/);
      const dayNum = dayNumMatch ? Number(dayNumMatch[0]) : NaN;
      const dm = formatDayMonth(dayNum);

      dayTag.innerHTML = `
        <span class="dow">${dow}</span>
        <span class="dm">${dm}</span>
      `;
      row.appendChild(dayTag);

      ["A","B","C"].forEach(gate => {
        const box = document.createElement("div");
        box.className = "gateBox";

        const grid = document.createElement("div");
        grid.className = "slotGrid";

        for (let shift = 1; shift <= 3; shift++) {
          const shiftRow = document.createElement("div");
          shiftRow.className = "shiftRow";

          const n = (shift === 1 ? slotCounts.s1 : shift === 2 ? slotCounts.s2 : slotCounts.s3);
          shiftRow.style.gridTemplateColumns = "repeat(3, minmax(0,1fr))";

          const allCols = SLOT_MAP[gate][shift];

          for (let i = 0; i < 3; i++) {
            if (i >= n) {
              const ghost = document.createElement("div");
              ghost.className = `slot s${shift} slot--ghost`;
              shiftRow.appendChild(ghost);
              continue;
            }

            const colLetters = allCols[i];
            const a1 = getA1(r.rIndex, colLetters);
            const value = getValueForA1_(r, a1);

            const slot = document.createElement("div");
            slot.className = `slot s${shift}`;
            slot.dataset.a1 = a1;
            slot.dataset.row = String(r.rIndex);

            if (editMode && isAdmin) {
              makeSlotEditable(slot, value);
            } else {
              slot.textContent = value || "";
              attachDoubleTap(slot, () => onSlotDoubleTap(slot));
            }

            shiftRow.appendChild(slot);
          }

          grid.appendChild(shiftRow);
        }

        box.appendChild(grid);
        row.appendChild(box);
      });

      calGrid.appendChild(row);
    });
  }

  // ===== Slot interactions =====
  async function onSlotDoubleTap(slotEl) {
    if (bookingGate === 1 && !isAdmin) {
      showPopup("Bookings are closed.");
      return;
    }

    if (!slotEl || editMode) return;

    const a1 = slotEl.dataset.a1;
    const current = String(slotEl.textContent || "").trim().toUpperCase();

    const rowNum = Number(slotEl.dataset.row);
    const rowObj = monthRows.find(r => r.rIndex === rowNum);
    if (rowObj && isPastRow(rowObj)) {
      showPopup("Past dates cannot be booked.");
      return;
    }

    if (current && current !== userCode) {
      showPopup("This slot is already booked.");
      return;
    }

    const actionText = current ? "Cancelling..." : "Booking...";

    try {
      showCenter(actionText);
      setStatus("Saving...");

      const data = await apiPost({
        mode: "toggle",
        monthKey: currentMonth,
        a1,
        code: userCode,
        role
      });

      const value = String(data.value || "").trim().toUpperCase();
      slotEl.textContent = value;

      const rowObj2 = monthRows.find(r => r.rIndex === rowNum);
      if (rowObj2) setValueForA1_(rowObj2, a1, value);

      hideCenter();
      applyBookingGateUI();
    } catch (err) {
      hideCenter();
      showPopup(String(err.message || err));
      applyBookingGateUI();
    }
  }

  function makeSlotEditable(slotEl, value) {
    slotEl.classList.add("editable");
    slotEl.innerHTML = "";

    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = String(value || "").trim().toUpperCase();
    inp.autocomplete = "off";
    inp.spellcheck = false;

    inp.addEventListener("input", () => {
      inp.value = String(inp.value || "").toUpperCase();
      markDirty(slotEl.dataset.a1, inp.value);
      scheduleAutosave();
    });

    inp.addEventListener("blur", () => {
      markDirty(slotEl.dataset.a1, inp.value);
      scheduleAutosave(250);
    });

    slotEl.appendChild(inp);
  }

  function markDirty(a1, val) {
    dirty.set(String(a1 || "").trim().toUpperCase(), String(val || "").trim().toUpperCase());
  }

  function scheduleAutosave(delay = 650) {
    if (!isAdmin || !editMode) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      saveDirty(false);
    }, delay);
  }

  async function saveDirty(showOverlayCard) {
    if (!isAdmin) return;
    if (!dirty.size) return;

    const updates = [];
    dirty.forEach((value, a1) => updates.push({ a1, value }));

    try {
      if (showOverlayCard) showCenter("Saving...");
      setStatus("Saving...");

      await apiPost({ mode: "saveCells", monthKey: currentMonth, updates });

      dirty.clear();
      applyUpdatesToUI(updates);

      if (showOverlayCard) hideCenter();
      applyBookingGateUI();
    } catch (err) {
      if (showOverlayCard) hideCenter();
      showPopup(String(err.message || err));
      applyBookingGateUI();
    }
  }

  function applyUpdatesToUI(updates) {
    updates.forEach(u => {
      const a1 = String(u.a1 || "").trim().toUpperCase();
      const val = String(u.value || "").trim().toUpperCase();

      const el = calGrid.querySelector(`.slot[data-a1="${a1}"]`);
      if (el) {
        const input = el.querySelector("input");
        if (input) input.value = val;
        else el.textContent = val;
      }

      const m = a1.match(/([A-Z]+)(\d+)/);
      if (!m) return;

      const rowNum = Number(m[2]);
      const rowObj = monthRows.find(r => r.rIndex === rowNum);
      if (rowObj) setValueForA1_(rowObj, a1, val);
    });
  }

  // ===== Load / init =====
  async function loadInit() {
    who = await waitForWho();
    if (!who) {
      window.location.replace("/");
      return;
    }

    role = String(who.role || "").toUpperCase();
    isAdmin = isAdminRole(role);

    if (adminBar) adminBar.hidden = !isAdmin;
    if (editBtn) editBtn.hidden = !isAdmin;
    if (saveBtn) saveBtn.hidden = !isAdmin;

    setBookingGateVisibility();

    if (goAdmin) goAdmin.hidden = !isAdmin;
    if (monthBox) monthBox.disabled = !isAdmin;

    userCode = getUserDisplayCode(who);
    if (!userCode) {
      showPopup("Account code missing. Please contact admin.");
      return;
    }

    refreshPushCard().catch(() => {});
    ensureServiceWorker().catch(() => {});

    pageTitle.textContent = "BOOK GREETINGS";
    setStatus("Loading. Please wait...");

    init = await apiGet({ mode: "init", code: userCode });

    bookingGate = Number(init.bookingGate || 0);
    applyBookingGateUI();

    currentMonth = String(init.monthKey || "JAN").toUpperCase();
    slotCounts = init.slotCounts || {
      s1: init.slotCount || 1,
      s2: init.slotCount || 1,
      s3: init.slotCount || 1
    };

    const s1 = init.shifts?.[0] || {};
    const s2 = init.shifts?.[1] || {};
    const s3 = init.shifts?.[2] || {};

    tShift1.textContent = `SHIFT 1:   ${s1.start || "--"} to ${s1.end || "--"}`;
    tShift2.textContent = `SHIFT 2:   ${s2.start || "--"} to ${s2.end || "--"}`;
    tShift3.textContent = `SHIFT 3:   ${s3.start || "--"} to ${s3.end || "--"}`;

    monthText.textContent = monthLabel(currentMonth);
    buildMonthMenu();

    await loadMonth(currentMonth, true);

    applyBookingGateUI();
  }

  async function loadMonth(monthKey, autoWeek) {
    if (editMode) {
      editMode = false;
      dirty.clear();
      editBtn.textContent = "Edit mode: OFF";
    }

    setStatus("Loading. Please wait...");

    currentMonth = String(monthKey || "JAN").toUpperCase();
    monthText.textContent = monthLabel(currentMonth);

    const data = await apiGet({ mode: "month", month: currentMonth });
    monthRows = Array.isArray(data.rows) ? data.rows : [];
    computeShownRows();

    const wk = autoWeek ? findCurrentWeek() : selectedWeek;
    setWeek(wk);

    applyBookingGateUI();
  }

  // ===== Events =====
  xBtn?.addEventListener("click", () => go(ROUTE_CAMERA));

  kebabBtn?.addEventListener("click", openOverlay);
  overlayDim?.addEventListener("click", closeOverlay);
  panelCloseBtn?.addEventListener("click", closeOverlay);

  goBookGreetings?.addEventListener("click", () => go(ROUTE_BOOK));
  goMySchedule?.addEventListener("click", () => go(ROUTE_ME));
  goAdmin?.addEventListener("click", () => {
    if (isAdmin) go(ROUTE_ADMIN);
  });

  monthBox?.addEventListener("click", () => {
    if (!isAdmin) return;
    if (monthMenu.hidden) openMonthMenu();
    else closeMonthMenu();
  });

  document.addEventListener("click", (e) => {
    if (!isAdmin) return;
    const t = e.target;
    if (!t) return;
    if (t === monthBox || monthBox.contains(t) || t === monthMenu || monthMenu.contains(t)) return;
    closeMonthMenu();
  });

  weekPrev?.addEventListener("click", () => setWeek(Math.max(1, selectedWeek - 1)));
  weekNext?.addEventListener("click", () => setWeek(Math.min(maxWeeks, selectedWeek + 1)));
  weekPill?.addEventListener("click", cycleWeek);

  popupX?.addEventListener("click", hidePopup);
  popup?.addEventListener("click", (e) => {
    if (e.target === popup) hidePopup();
  });

  editBtn?.addEventListener("click", () => {
    if (!isAdmin) return;
    editMode = !editMode;
    dirty.clear();
    editBtn.textContent = editMode ? "Edit mode: ON" : "Edit mode: OFF";
    renderWeek();
    applyBookingGateUI();
  });

  saveBtn?.addEventListener("click", async () => {
    if (!isAdmin) return;
    await saveDirty(true);
  });

  bookingGateToggle?.addEventListener("click", async () => {
    if (!isAdmin) return;

    const newValue = bookingGate === 1 ? 0 : 1;

    try {
      showCenter("Saving...");

      const res = await apiPost({
        mode: "setBookingGate",
        value: newValue,
        role
      });

      bookingGate = Number(res.bookingGate || 0);
      hideCenter();
      applyBookingGateUI();
    } catch (err) {
      hideCenter();
      showPopup(String(err.message || err));
      applyBookingGateUI();
    }
  });

  pushEnableBtn?.addEventListener("click", async () => {
    try {
      await enablePushNotifications();
    } catch (err) {
      showPopup(String(err.message || err));
      await refreshPushCard();
    }
  });

  pushLaterBtn?.addEventListener("click", () => {
    showPopup("Notifications can be enabled later from this card.");
  });

  // ===== Start =====
  loadInit().catch(err => {
    console.error(err);
    showPopup(String(err.message || err));
    setStatus("Tap twice to book or unbook.");
  });

})();
