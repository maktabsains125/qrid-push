/* /shared/camera/camera.js — Camera mode (QR via device camera)
 *
 * Flow:
 * 1) Show "Please wait..."
 * 2) Await /scan response
 * 3) Show success card
 *
 * WARM LAYERS:
 * - Scheduled warm from Netlify warm-camera.js
 * - Lazy warm on page load
 * - Lazy warm on camera open / tab re-focus
 *
 * FIX (session issues):
 * - Always include { token } in BODY for scan (GAS often drops Authorization header)
 * - Still sends Authorization header too (harmless)
 */

(function () {
  "use strict";

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

    status: $("status"),
    result: $("result"),
    resName: $("resName"),
    resId: $("resId"),
    resMark: $("resMark"),
    resTime: $("resTime"),
    resManual: $("resManual"),
    closeCard: $("closeCard"),
    nextBtn: $("nextBtn"),

    camDlg: $("camDlg"),
    closeCam: $("closeCam"),
    preview: $("preview"),

    amTime: $("amTime"),
    pmTime: $("pmTime"),
    buildTag: $("buildTag"),

    exitBtn: $("exitBtn"),

    kebabBtn: $("kebabBtn"),
    overlay: $("overlay"),
    overlayDim: $("overlayDim"),
    panelCloseBtn: $("panelCloseBtn"),
    goBookGreetings: $("goBookGreetings"),
    goMySchedule: $("goMySchedule"),
    goAdmin: $("goAdmin")
  };

  const role = String(who.role || "").toUpperCase().trim();
  const isAdmin = (role === "ADMIN" || role === "CODER");

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
    if (els.resManual) els.resManual.textContent = d.manual ?? "";
  }

  function showCard(d){
    populateCard(d);
    els.result?.classList.remove("hidden");
  }

  function hideCard(){
    els.result?.classList.add("hidden");
  }

  els.exitBtn?.addEventListener("click", () => {
    const route = (window.Auth && Auth.routeFor && Auth.routeFor(who.role)) || "/";
    location.assign(route);
  });

  els.scannerBtn?.addEventListener("click", () => {
    location.assign("/shared/camera/scanner.html");
  });

  els.manualBtn?.addEventListener("click", () => {
    location.assign("/shared/camera/manual.html");
  });

  // ===== ZXing camera =====
  const codeReader = new ZXing.BrowserMultiFormatReader();
  let closedByMe = false;
  let busyScan = false;

  // ===== Lazy warm =====
  let lastWarmAt = 0;
  let warmInFlight = null;
  const WARM_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

  function warmBackend(force = false) {
    const now = Date.now();

    if (!force && (now - lastWarmAt) < WARM_COOLDOWN_MS) return Promise.resolve();
    if (warmInFlight) return warmInFlight;

    lastWarmAt = now;

    warmInFlight = fetch(`${WEBAPP_URL}?mode=ping`, {
      method: "GET",
      cache: "no-store"
    })
      .catch(() => {})
      .finally(() => {
        warmInFlight = null;
      });

    return warmInFlight;
  }

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

  async function openCamera(){
    closedByMe = false;

    // Layer 3: warm again when opening camera (fire-and-forget)
    warmBackend();

    try { await codeReader.reset(); } catch(_){}
    try { els.camDlg?.showModal(); } catch(_){}

    try {
      await codeReader.decodeFromVideoDevice(null, els.preview, (result) => {
        if (!result || closedByMe) return;

        // block double callbacks
        closedByMe = true;

        const raw = String(result.getText() || "");
        const { id, name } = parseQrPayload(raw);

        // Start fetch ASAP
        clockInScan({ id, name });

        // Stop camera next tick (avoid blocking fetch start)
        setTimeout(closeCamera, 0);
      });
    } catch (err) {
      alert("Camera error: " + String(err?.message || err));
      closeCamera();
    }
  }

  function closeCamera(){
    closedByMe = true;
    try { els.camDlg?.close(); } catch(_){}
    try { codeReader.reset(); } catch(_){}

    if (els.preview?.srcObject) {
      try { els.preview.srcObject.getTracks().forEach(t => t.stop()); } catch(_){}
      els.preview.srcObject = null;
    }
  }

  els.cameraBtn?.addEventListener("click", () => {
    hideCard();
    hideStatus();
    openCamera();
  });

  els.closeCam?.addEventListener("click", closeCamera);
  els.closeCard?.addEventListener("click", hideCard);

  els.nextBtn?.addEventListener("click", () => {
    hideCard();
    hideStatus();

    // warm before reopening
    warmBackend();

    closeCamera();
    openCamera();
  });

  function getSavedToken(){
    try {
      const s = JSON.parse(localStorage.getItem("mspsbs_session") || "null");
      return s?.token || null;
    } catch (_) {
      return null;
    }
  }

  function clearSessionAndKick(){
    try { localStorage.removeItem("mspsbs_session"); } catch(_){}
    alert("Session expired. Please log in again.");
    location.replace("/");
  }

  async function api(mode, payload, { timeoutMs } = {}){
    const token = getSavedToken();
    const ctrl = timeoutMs ? new AbortController() : null;
    const t = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

    try {
      const resp = await fetch(`${WEBAPP_URL}?mode=${encodeURIComponent(mode)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload || {}),
        signal: ctrl?.signal
      });

      const txt = await resp.text();

      let json;
      try { json = JSON.parse(txt); }
      catch { json = { ok: false, error: `Bad JSON: ${txt.slice(0, 200)}` }; }

      if (resp.status === 401 || /invalid|expired session/i.test(String(json?.error || ""))) {
        clearSessionAndKick();
        throw new Error("Invalid or expired session");
      }

      if (!resp.ok) {
        const msg = json?.error ? String(json.error) : `HTTP ${resp.status} ${txt}`;
        throw new Error(msg);
      }

      return json;
    } catch (err) {
      if (err?.name === "AbortError") throw new Error("Request timed out");
      throw err;
    } finally {
      if (t) clearTimeout(t);
    }
  }

  async function clockInScan({ id, name }){
    if (!id) {
      alert("QR did not contain a valid ID.");
      return;
    }
    if (busyScan) return;
    busyScan = true;

    const token = getSavedToken();
    if (!token) {
      busyScan = false;
      alert("Not logged in.");
      return;
    }

    hideCard();
    showStatus("Please wait...");

    try {
      const scanRes = await api("scan", { token, id, name }, { timeoutMs: 22000 });

      if (!scanRes || scanRes.ok !== true) {
        throw new Error(scanRes?.error || "Scan failed");
      }

      hideStatus();

      showCard({
        name: scanRes.name ?? name ?? "—",
        id:   scanRes.id ?? id,
        mark: scanRes.mark ?? "✔",
        time: new Date().toLocaleTimeString(),
      });

    } catch (err) {
      hideStatus();
      showCard({
        name: name || "—",
        id,
        mark: "ERR",
        time: new Date().toLocaleTimeString(),
      });
      alert(String(err?.message || err));
    } finally {
      busyScan = false;
    }
  }

  // Layer 2: warm once on page load
  warmBackend();

  // Layer 3 backup: warm when tab becomes active again
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) warmBackend();
  });

  // Init: load session windows/build
  (async function loadConfig(){
    try {
      const r = await api("config", null, { timeoutMs: 8000 });

      if (r?.sessions) {
        const am = r.sessions.AM, pm = r.sessions.PM;
        if (am && els.amTime) els.amTime.textContent = `${am.windowStart}–${am.windowEnd} (L: ${am.lateCutoff})`;
        if (pm && els.pmTime) els.pmTime.textContent = `${pm.windowStart}–${pm.windowEnd} (L: ${pm.lateCutoff})`;
      }
      if (r?.build && els.buildTag) els.buildTag.textContent = r.build;

    } catch (_) {}
  })();

})();
