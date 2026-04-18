/* /shared/camera/scanner.js — Scanner mode (USB/Bluetooth QR scanner)
   FIXES:
   - Removed manualCount/resManual usage (no longer exists)
   - Removed animated dots (static status)
   - process endpoint now sends { token }
   CHANGES (this update):
   - Full name (no firstTwo trimming)
   - Card appears ONLY after backend logs (show "Please wait..." first)
   - Adds JSON Content-Type header
   - Adds busy guard (prevents double-scans while request in-flight)
*/

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  const WEBAPP_URL = "/.netlify/functions/camera";
  const $ = (id) => document.getElementById(id);

  const els = {
    cameraBtn:  $("cameraBtn"),
    scannerBtn: $("scannerBtn"),
    manualBtn:  $("manualBtn"),

    scannerInput: $("scannerInput"),

    status: $("status"),
    result: $("result"),
    resName: $("resName"),
    resId: $("resId"),
    resMark: $("resMark"),
    resTime: $("resTime"),
    closeCard: $("closeCard"),

    amTime: $("amTime"),
    pmTime: $("pmTime"),
    buildTag: $("buildTag"),

    exitBtn: $("exitBtn"),

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
  function openOverlay(){ if (els.overlay) els.overlay.hidden = false; }
  function closeOverlay(){ if (els.overlay) els.overlay.hidden = true; }

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

  // ==== UI helpers ====
  function showStatus(msg){
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.remove("hidden");
  }
  function hideStatus(){
    els.status?.classList.add("hidden");
  }

  function populateCard(d){
    if (!els.result) return;
    if (els.resName) els.resName.textContent = d.name ?? "—";
    if (els.resId)   els.resId.textContent   = d.id ?? "—";
    if (els.resMark) els.resMark.textContent = d.mark ?? "—";
    if (els.resTime) els.resTime.textContent = d.time ?? new Date().toLocaleTimeString();
  }

  function showCard(d){ populateCard(d); els.result?.classList.remove("hidden"); }
  function hideCard(){ els.result?.classList.add("hidden"); }

  // Unified QR payload parser
  function parseQrPayload(raw) {
    const s = String(raw || "");
    let id = "", name = "";
    try {
      const obj = JSON.parse(s);
      id = obj.id || "";
      name = obj.name || "";
    } catch (_) {
      const parts = s.split("|");
      if (parts.length >= 2) {
        id = parts[0].trim();
        name = parts.slice(1).join("|").trim();
      } else {
        id = s.trim();
      }
    }
    return { id, name };
  }

  // ==== Exit button ====
  els.exitBtn?.addEventListener("click", () => {
    const route = (window.Auth && Auth.routeFor && Auth.routeFor(who.role)) || "/";
    location.assign(route);
  });

  // ==== Top buttons ====
  els.cameraBtn?.addEventListener("click", () => {
    location.assign("/shared/camera/index.html");
  });

  els.scannerBtn?.addEventListener("click", () => {
    // already here; no-op
  });

  els.manualBtn?.addEventListener("click", () => {
    location.assign("/shared/camera/manual.html");
  });

  els.closeCard?.addEventListener("click", hideCard);

  // ==== API ====
  async function api(mode, payload, {timeoutMs} = {}){
    const ctrl = timeoutMs ? new AbortController() : null;
    const t = timeoutMs ? setTimeout(()=>ctrl.abort(), timeoutMs) : null;

    try{
      const resp = await fetch(`${WEBAPP_URL}?mode=${encodeURIComponent(mode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload || {}),
        signal: ctrl?.signal
      });

      const txt = await resp.text();
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${txt}`);
      try { return JSON.parse(txt); }
      catch { throw new Error(`Bad JSON: ${txt.slice(0,200)}`); }
    } finally {
      if (t) clearTimeout(t);
    }
  }

  function getSavedToken(){
    try{
      const s = JSON.parse(localStorage.getItem("mspsbs_session")||"null");
      return s?.token || null;
    }catch(_){ return null; }
  }

  let busy = false;

  // ==== Flow: wait → backend logs → card appears (FULL NAME) ====
  async function clockInScan({id, name}){
    if(!id){ alert("QR did not contain a valid ID."); return; }
    if (busy) return;
    busy = true;

    const token = getSavedToken();
    if (!token) { busy = false; alert("Not logged in."); return; }

    // show wait first; no card until backend confirms logged
    hideCard();
    showStatus("Please wait...");

    try {
      const scanRes = await api("scan", { token, id, name }, { timeoutMs: 15000 });

      if (!scanRes || scanRes.ok !== true) {
        const msg = (scanRes && scanRes.error) ? scanRes.error : "Scan failed";
        throw new Error(msg);
      }

      hideStatus();

      // FULL NAME (no trimming)
      showCard({
        name: scanRes.name ?? name ?? "—",
        id:   scanRes.id ?? id,
        mark: scanRes.mark ?? "✔",
        time: scanRes.time || new Date().toLocaleTimeString()
      });

      // Keep async processing (doesn't block card)
      setTimeout(async () => {
        try {
          await api("process", { token }, { timeoutMs: 15000 });
        } catch(_) {}
      }, 0);

    } catch (err) {
      hideStatus();
      showCard({
        name: name || "—",
        id,
        mark: "ERR",
        time: new Date().toLocaleTimeString()
      });
      alert(String(err.message || err));
    } finally {
      busy = false;
    }
  }

  // ==== Hardware QR scanner: always ready ====
  (function setupScanner(){
    const inp = els.scannerInput;
    if (!inp) return;

    function focusScanner(){
      inp.focus();
      inp.select();
    }

    inp.addEventListener("keydown", (e)=>{
      if (e.key === "Enter"){
        e.preventDefault();
        const raw = inp.value || "";
        inp.value = "";

        const { id, name } = parseQrPayload(raw);
        if (!id){
          alert("QR did not contain a valid ID.");
          return;
        }

        // no hideStatus() here; clockInScan will show "Please wait..."
        hideCard();
        clockInScan({ id, name });
      }
    });

    window.addEventListener("load", focusScanner);
    inp.addEventListener("blur", () => {
      setTimeout(focusScanner, 80);
    });
  })();

  // ==== Init: load session windows/build ====
  (async function loadConfig(){
    try{
      const r = await api("config", null, { timeoutMs: 8000 });
      if (r?.sessions){
        const am=r.sessions.AM, pm=r.sessions.PM;
        if (am && els.amTime) els.amTime.textContent = `${am.windowStart}–${am.windowEnd} (L: ${am.lateCutoff})`;
        if (pm && els.pmTime) els.pmTime.textContent = `${pm.windowStart}–${pm.windowEnd} (L: ${pm.lateCutoff})`;
      }
      if (r?.build && els.buildTag) els.buildTag.textContent = r.build;
    }catch(_){}
  })();

})();