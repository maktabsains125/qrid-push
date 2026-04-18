/* /shared/camera/manual.js — Manual attendance page with themed combobox
   - No-Enter flow (pick → close → enable → focus Clock in)
   - Mobile-hardened (scrollable list, drag-vs-tap guard)
   - Squelch programmatic input to prevent re-open
   - Auto re-login on 401 / expired session

   CHANGES (this update):
   - Full name everywhere (removed firstTwo trimming)
   - Status shows full name, card still appears only after backend logs
   - Adds JSON Content-Type header
   - Adds timeouts (prevents hangs)
   - Adds busy guard (prevents double manual clock-ins)
   - Better search debounce
   - Ignores stale/out-of-order search responses
   - Reuses cached results for repeated queries
   - Shows "Searching..." item in dropdown
   - Shows "No results found" item in dropdown
   - Reopens list more reliably
   - Clears stale selection when typing again
   - Prevents old results from reopening after a no-result search
   - Aborts older in-flight searches
   - Forces current typed query to control dropdown state
*/

(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // ==== CONFIG (same proxy as camera app) ====
  const WEBAPP_URL = "/.netlify/functions/camera";

  // ==== DOM ====
  const $ = (id) => document.getElementById(id);
  const els = {
    cameraBtn:  $("cameraBtn"),
    scannerBtn: $("scannerBtn"),
    manualBtn:  $("manualBtn"),

    issue: $("issue"),
    nameInput: $("nameInput"),
    nameList: $("nameList"),
    nameCombo: $("nameCombo"),
    clockBtn: $("clockBtn"),
    exitBtn: $("exitBtn"),

    idOut: $("idOut"),

    status: $("status"),
    result: $("result"),

    resName: $("resName"),
    resId: $("resId"),
    resMark: $("resMark"),
    resTime: $("resTime"),

    closeCard: $("closeCard"),

    // kebab / overlay
    kebabBtn: $("kebabBtn"),
    overlay: $("overlay"),
    overlayDim: $("overlayDim"),
    panelCloseBtn: $("panelCloseBtn"),
    goBookGreetings: $("goBookGreetings"),
    goMySchedule: $("goMySchedule"),
    goAdmin: $("goAdmin")
  };

  // ===== Role helpers =====
  const role = String(who.role || "").toUpperCase().trim();
  const isAdmin = (role === "ADMIN" || role === "CODER");

  // ===== Kebab behavior =====
  function openOverlay() {
    if (els.overlay) els.overlay.hidden = false;
  }

  function closeOverlay() {
    if (els.overlay) els.overlay.hidden = true;
  }

  if (!isAdmin && els.goAdmin) els.goAdmin.style.display = "none";

  els.kebabBtn?.addEventListener("click", openOverlay);
  els.overlayDim?.addEventListener("click", closeOverlay);
  els.panelCloseBtn?.addEventListener("click", closeOverlay);

  els.goBookGreetings?.addEventListener("click", () => {
    closeOverlay();
    location.assign("/shared/camera/greetings/bookings.html");
  });

  els.goMySchedule?.addEventListener("click", () => {
    closeOverlay();
    location.assign("/shared/camera/schedule/my-schedule.html");
  });

  els.goAdmin?.addEventListener("click", () => {
    if (!isAdmin) return;
    closeOverlay();
    location.assign("/shared/camera/admin/admin-book.html");
  });

  // Quick sanity logs if markup is missing
  if (!els.nameInput || !els.nameList || !els.nameCombo) {
    console.error("[manual.js] Missing combobox elements (#nameInput, #nameList, #nameCombo).");
  }
  if (!els.clockBtn) console.error("[manual.js] Missing #clockBtn.");
  if (!els.issue) console.error("[manual.js] Missing #issue.");
  if (!els.status) console.error("[manual.js] Missing #status.");
  if (!els.result) console.error("[manual.js] Missing #result.");

  // ==== Page state ====
  let selected = { name: "", id: "" };
  let lastSearch = [];
  let open = false;
  let activeIndex = -1;
  let squelchInput = false;
  let searchTimer = null;
  let busyClockIn = false;

  // search state
  let searchSeq = 0;
  let latestAppliedSeq = 0;
  let lastQuery = "";
  let isSearching = false;
  let activeSearchController = null;
  const searchCache = new Map();

  // ==== UI helpers ====
  function showStatus(msg) {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.remove("hidden");
  }

  function hideStatus() {
    if (!els.status) return;
    els.status.classList.add("hidden");
  }

  function showCard(d) {
    if (!els.result) return;
    if (els.resName) els.resName.textContent = d.name || "—";
    if (els.resId) els.resId.textContent = d.id || "—";
    if (els.resMark) els.resMark.textContent = d.mark || "—";
    if (els.resTime) els.resTime.textContent = d.time || new Date().toLocaleTimeString();
    els.result.classList.remove("hidden");
  }

  function hideCard() {
    els.result?.classList.add("hidden");
  }

  // ==== API helper (auto-logout on 401/expired) ====
  async function api(mode, payload, { timeoutMs } = {}) {
    const ctrl = timeoutMs ? new AbortController() : null;
    const t = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

    try {
      const resp = await fetch(`${WEBAPP_URL}?mode=${encodeURIComponent(mode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload || {}),
        signal: ctrl?.signal
      });

      const txt = await resp.text();
      let json;

      try {
        json = JSON.parse(txt);
      } catch {
        json = { error: `Bad JSON: ${txt.slice(0, 200)}` };
      }

      // backend may reply 200 with {error:"Invalid or expired session"}
      if (resp.status === 401 || /Invalid|expired session/i.test(String(json?.error || ""))) {
        try { localStorage.removeItem("mspsbs_session"); } catch (_) {}
        alert("Your session expired. Please log in again.");
        location.replace("/");
        throw new Error("401 invalid/expired session");
      }

      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${txt}`);
      return json;
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw err;
    } finally {
      if (t) clearTimeout(t);
    }
  }

  function getSavedToken() {
    try {
      const s = JSON.parse(localStorage.getItem("mspsbs_session") || "null");
      return s?.token || null;
    } catch (_) {
      return null;
    }
  }

  // ==== Search helpers ====
  function normalizeQuery(q) {
    return String(q || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function currentSelectedText() {
    return selected.id ? `${selected.name} [${selected.id}]` : "";
  }

  function currentInputLooksSelected() {
    const v = normalizeQuery(els.nameInput?.value || "");
    return !!selected.id && v === currentSelectedText();
  }

  function clearSelection() {
    selected = { name: "", id: "" };
    if (els.idOut) els.idOut.textContent = "";
  }

  function maybeEnableClock() {
    const can = !!(els.issue && els.issue.value && selected.id);
    if (els.clockBtn) els.clockBtn.disabled = !can;
  }

  function hasCurrentRealResults(term) {
    return (
      term.length >= 2 &&
      !currentInputLooksSelected() &&
      lastSearch.length > 0 &&
      term === lastQuery &&
      !isSearching
    );
  }

  function openList() {
    if (!els.nameList) return;
    if (!els.nameList.children.length) return;
    open = true;
    els.nameInput?.setAttribute("aria-expanded", "true");
    els.nameList.classList.add("open");
  }

  function closeList() {
    open = false;
    activeIndex = -1;
    els.nameInput?.setAttribute("aria-expanded", "false");
    els.nameInput?.setAttribute("aria-activedescendant", "");
    els.nameList?.classList.remove("open");
  }

  function setActive(i) {
    if (!els.nameList) return;

    [...els.nameList.children].forEach((el) => el.classList.remove("active"));

    if (i >= 0 && i < els.nameList.children.length) {
      const row = els.nameList.children[i];
      if (row.dataset.disabled === "1") {
        els.nameInput?.setAttribute("aria-activedescendant", "");
        return;
      }

      row.classList.add("active");
      els.nameInput?.setAttribute("aria-activedescendant", row.id);

      try {
        row.scrollIntoView({ block: "nearest" });
      } catch (_) {}
    } else {
      els.nameInput?.setAttribute("aria-activedescendant", "");
    }
  }

  function renderMessageRow(text) {
    if (!els.nameList) return;

    els.nameList.innerHTML = "";

    const li = document.createElement("li");
    li.id = "opt-msg";
    li.setAttribute("role", "option");
    li.className = "comboOption";
    li.dataset.disabled = "1";
    li.style.cursor = "default";
    li.style.opacity = "0.7";
    li.textContent = text;

    els.nameList.appendChild(li);
    activeIndex = -1;
  }

  function highlightMatch(text, term) {
    const rawText = String(text);
    const t = normalizeQuery(term);

    if (!t) return escapeHtml(rawText);

    const escapedRaw = escapeHtml(rawText);
    const re = new RegExp(`(${escapeRegExp(t)})`, "ig");

    if (!re.test(rawText)) return escapedRaw;

    return escapedRaw.replace(
      new RegExp(`(${escapeRegExp(escapeHtml(t))})`, "ig"),
      "<mark>$1</mark>"
    );
  }

  function renderOptions(arr, term) {
    if (!els.nameList) return;

    els.nameList.innerHTML = "";
    const frag = document.createDocumentFragment();

    arr.forEach((r, i) => {
      const li = document.createElement("li");
      li.id = "opt-" + i;
      li.setAttribute("role", "option");
      li.className = "comboOption";
      li.dataset.index = String(i);

      const nameHtml = highlightMatch(r.name, term);
      const idHtml = highlightMatch(r.id, term);
      li.innerHTML = `${nameHtml} [${idHtml}]`;

      let startY = 0;
      let startX = 0;
      let moved = false;
      const threshold = 6;

      const getPointY = (e) => e.clientY ?? (e.touches?.[0]?.clientY || 0);
      const getPointX = (e) => e.clientX ?? (e.touches?.[0]?.clientX || 0);

      const onPointerDown = (e) => {
        moved = false;
        startY = getPointY(e);
        startX = getPointX(e);
      };

      const onPointerMove = (e) => {
        const dy = Math.abs(getPointY(e) - startY);
        const dx = Math.abs(getPointX(e) - startX);
        if (dy > threshold || dx > threshold) moved = true;
      };

      const onPointerUp = (e) => {
        if (!moved) {
          e.preventDefault();
          pickIndex(i);
        }
      };

      li.addEventListener("pointerdown", onPointerDown, { passive: true });
      li.addEventListener("pointermove", onPointerMove, { passive: true });
      li.addEventListener("pointerup", onPointerUp);
      li.addEventListener("click", (e) => {
        e.preventDefault();
        pickIndex(i);
      });

      frag.appendChild(li);
    });

    els.nameList.appendChild(frag);

    if (arr.length) {
      activeIndex = 0;
      setActive(activeIndex);
    } else {
      activeIndex = -1;
    }
  }

  function abortActiveSearch() {
    if (activeSearchController) {
      try { activeSearchController.abort(); } catch (_) {}
      activeSearchController = null;
    }
  }

  function showSearchingRow() {
    lastSearch = [];
    activeIndex = -1;
    renderMessageRow("Searching...");
    openList();
  }

  function showNoResultsRow(term, seq) {
    if (seq < latestAppliedSeq) return;
    if (term !== lastQuery) return;

    lastSearch = [];
    activeIndex = -1;
    isSearching = false;
    renderMessageRow("No results found");
    openList();
  }

  function applySearchResults(term, results, seq) {
    if (seq < latestAppliedSeq) return;
    if (term !== lastQuery) return;

    const liveInput = normalizeQuery(els.nameInput?.value || "");
    if (term !== liveInput) return;

    latestAppliedSeq = seq;
    isSearching = false;

    const safeResults = Array.isArray(results) ? results : [];

    if (!safeResults.length) {
      showNoResultsRow(term, seq);
      return;
    }

    lastSearch = safeResults;
    renderOptions(lastSearch, term);

    if (!currentInputLooksSelected()) {
      openList();
    }
  }

  async function doSearch(term, seq) {
    const q = normalizeQuery(term);

    if (q.length < 2) return;
    if (q !== lastQuery) return;

    if (searchCache.has(q)) {
      applySearchResults(q, searchCache.get(q), seq);
      return;
    }

    abortActiveSearch();
    activeSearchController = new AbortController();

    try {
      const resp = await fetch(`${WEBAPP_URL}?mode=${encodeURIComponent("search")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ q }),
        signal: activeSearchController.signal
      });

      const txt = await resp.text();
      let json;

      try {
        json = JSON.parse(txt);
      } catch {
        json = { error: `Bad JSON: ${txt.slice(0, 200)}` };
      }

      // backend may reply 200 with {error:"Invalid or expired session"}
      if (resp.status === 401 || /Invalid|expired session/i.test(String(json?.error || ""))) {
        try { localStorage.removeItem("mspsbs_session"); } catch (_) {}
        alert("Your session expired. Please log in again.");
        location.replace("/");
        throw new Error("401 invalid/expired session");
      }

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const results = (json && json.ok && Array.isArray(json.results)) ? json.results : [];

      searchCache.set(q, results);
      if (searchCache.size > 40) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
      }

      applySearchResults(q, results, seq);
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (q !== lastQuery) return;

      // Do not show "No results found" for random request failures.
      // Keep the current UI and let the next live query win.
      isSearching = false;
    } finally {
      if (activeSearchController?.signal?.aborted) {
        activeSearchController = null;
      }
    }
  }

  function queueSearch(rawValue) {
    const term = normalizeQuery(rawValue);

    window.clearTimeout(searchTimer);
    searchTimer = null;

    lastQuery = term;

    if (term.length < 2) {
      isSearching = false;
      lastSearch = [];
      activeIndex = -1;
      if (els.nameList) els.nameList.innerHTML = "";
      abortActiveSearch();
      closeList();
      return;
    }

    const seq = ++searchSeq;
    isSearching = true;
    showSearchingRow();

    searchTimer = window.setTimeout(() => {
      if (term !== lastQuery) return;
      doSearch(term, seq);
    }, 250);
  }

  function pickIndex(i) {
    if (i < 0 || i >= lastSearch.length) return;

    const item = lastSearch[i];
    squelchInput = true;

    selected = { id: item.id, name: item.name };

    if (els.nameInput) els.nameInput.value = `${item.name} [${item.id}]`;
    if (els.idOut) els.idOut.textContent = item.id;

    window.clearTimeout(searchTimer);
    searchTimer = null;
    isSearching = false;
    lastQuery = "";
    abortActiveSearch();

    maybeEnableClock();
    closeList();
    els.nameInput?.blur();

    if (els.clockBtn && !els.clockBtn.disabled) {
      setTimeout(() => {
        els.clockBtn.focus({ preventScroll: true });
      }, 0);
    }

    setTimeout(() => {
      squelchInput = false;
    }, 300);
  }

  // ==== Events ====
  const caretBtn = els.nameCombo ? els.nameCombo.querySelector(".comboCaret") : null;

  if (caretBtn) {
    caretBtn.addEventListener("click", () => {
      const term = normalizeQuery(els.nameInput?.value || "");

      if (open) {
        closeList();
        return;
      }

      if (hasCurrentRealResults(term)) {
        renderOptions(lastSearch, term);
        openList();
      } else if (term.length >= 2 && !currentInputLooksSelected()) {
        queueSearch(term);
      } else if (els.nameList?.children?.length) {
        openList();
      }

      els.nameInput?.focus();
    });
  }

  els.nameInput?.addEventListener("focus", () => {
    const term = normalizeQuery(els.nameInput?.value || "");

    if (open && els.nameList?.children?.length) return;

    if (hasCurrentRealResults(term)) {
      renderOptions(lastSearch, term);
      openList();
      return;
    }

    if (isSearching && term.length >= 2 && term === lastQuery) {
      showSearchingRow();
      return;
    }

    if (term.length >= 2) {
      queueSearch(term);
    }
  });

  els.nameInput?.addEventListener("click", () => {
    const term = normalizeQuery(els.nameInput?.value || "");

    if (hasCurrentRealResults(term)) {
      renderOptions(lastSearch, term);
      openList();
      return;
    }

    if (isSearching && term.length >= 2 && term === lastQuery) {
      showSearchingRow();
      return;
    }

    if (term.length >= 2) {
      queueSearch(term);
    }
  });

  els.nameInput?.addEventListener("input", (e) => {
    if (squelchInput) return;

    clearSelection();
    maybeEnableClock();

    const q = e.target.value;
    queueSearch(q);
  });

  els.nameInput?.addEventListener("keydown", (e) => {
    const childCount = els.nameList?.children?.length || 0;

    if (e.key === "ArrowDown") {
      if (!open && childCount) openList();
      if (!lastSearch.length) return;

      activeIndex = Math.min(lastSearch.length - 1, (activeIndex < 0 ? 0 : activeIndex + 1));
      setActive(activeIndex);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      if (!open && childCount) openList();
      if (!lastSearch.length) return;

      activeIndex = Math.max(0, (activeIndex < 0 ? 0 : activeIndex - 1));
      setActive(activeIndex);
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && lastSearch.length) {
        pickIndex(activeIndex);
        e.preventDefault();
      }
    } else if (e.key === "Escape") {
      closeList();
    }
  });

  document.addEventListener("pointerdown", (e) => {
    if (!els.nameCombo) return;
    if (!els.nameCombo.contains(e.target)) closeList();
  });

  els.issue?.addEventListener("change", maybeEnableClock);
  els.issue?.addEventListener("input", maybeEnableClock);

  els.exitBtn?.addEventListener("click", () => {
    const route = (window.Auth && Auth.routeFor && Auth.routeFor(who.role)) || "/";
    location.assign(route);
  });

  // ==== Manual clock-in ====
  els.clockBtn?.addEventListener("click", async () => {
    if (busyClockIn) return;

    if (!els.issue || !els.issue.value) {
      alert("Please select a card issue.");
      return;
    }

    if (!selected.id) {
      alert("Please choose a student from the list.");
      return;
    }

    const token = getSavedToken();
    if (!token) {
      alert("Not logged in.");
      location.replace("/");
      return;
    }

    busyClockIn = true;
    showStatus(`Recording ${selected.name || "student"}. Please wait...`);

    try {
      const r = await api("manual", {
        token,
        id: selected.id,
        name: selected.name,
        issue: els.issue.value
      }, { timeoutMs: 15000 });

      if (!r || r.ok !== true) {
        const msg = (r && r.error) ? r.error : "Manual clock-in failed";
        throw new Error(msg);
      }

      hideStatus();
      showCard({
        name: r.name,
        id: r.id,
        mark: r.mark
      });

      setTimeout(async () => {
        try {
          await api("process", { token }, { timeoutMs: 15000 });
        } catch (_) {}
      }, 0);
    } catch (err) {
      hideStatus();
      alert(String(err.message || err));
    } finally {
      busyClockIn = false;
    }
  });

  // ==== Top buttons ====
  els.cameraBtn?.addEventListener("click", () => {
    location.assign("/shared/camera/index.html");
  });

  els.manualBtn?.addEventListener("click", () => {
    // already here; no-op
  });

  els.scannerBtn?.addEventListener("click", () => {
    location.assign("/shared/camera/scanner.html");
  });

  els.closeCard?.addEventListener("click", hideCard);

  // Initial state
  maybeEnableClock();
})();