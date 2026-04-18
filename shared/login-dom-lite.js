/* ============================================
 * login-dom-lite.js
 * Lightweight DOM login handler (no preflight)
 * - Uses URLSearchParams (form-encoded) POST
 * - Uses shared Auth from /auth.js (mspsbs_session)
 * - Clears state if arriving with ?logout=...
 * - Redirects by role via Auth.routeFor()
 * ============================================ */

(function(){
  "use strict";

  // ===== Pre-reqs =====
  if (typeof WEBAPP_URL !== "string" || !WEBAPP_URL) {
    console.error("WEBAPP_URL is not defined. Define it in /auth.js before this script.");
  }
  if (typeof window.Auth !== "object") {
    console.error("Auth helper not found. Make sure /auth.js is loaded BEFORE login-dom-lite.js");
  }

  // ===== DOM Elements =====
  const codeEl = document.getElementById("code");
  const passEl = document.getElementById("password");
  const btn    = document.getElementById("loginBtn");
  const msg    = document.getElementById("loginMsg");

  // Helpers
  const setBusy = (busy) => { if (btn) btn.disabled = !!busy; };
  const setMsg  = (text) => { if (msg) msg.textContent = text || ""; };

  // Utility: clear FT keys (avoid stale values when roles change)
  function clearFtKeys(){
    try {
      localStorage.removeItem("ms_level");
      localStorage.removeItem("ms_class");
      localStorage.removeItem("ms_anchor");   // ✅ was ms_reviewid
      localStorage.removeItem("ms_returnid");
      localStorage.removeItem("ms_profileid");
    } catch {}
  }

  // If coming from a logout redirect (e.g., /?logout=123), wipe leftovers BEFORE load()
  if (location.search.includes("logout")) {
    try { Auth.clear(); } catch {}
    clearFtKeys();
    try {
      // strip ?logout to avoid repeated clears on refresh
      const url = new URL(location.href);
      url.searchParams.delete("logout");
      history.replaceState(null, "", url.toString());
    } catch {}
  }

  // Auto-route if a valid session already exists
  const existing = Auth.load?.();
  if (existing) {
    // Optional: hydrate FT keys if session already has them (e.g., after refresh)
    if (existing.role === "FT") {
      try {
        if (localStorage.getItem("ms_level") === null) {
          localStorage.setItem("ms_level",     existing.level     ?? "");
          localStorage.setItem("ms_class",     existing.class     ?? "");
          localStorage.setItem("ms_anchor",    existing.anchor    ?? ""); // ✅ was ms_reviewid/existing.reviewid
          localStorage.setItem("ms_returnid",  existing.returnid  ?? "");
          localStorage.setItem("ms_profileid", existing.profileid ?? "");
        }
      } catch {}
    } else {
      clearFtKeys();
    }

    location.replace(Auth.routeFor(existing.role));
    return;
  }

  // Enable/disable button based on inputs
  const updateButtonState = () => {
    const ok = !!(codeEl?.value.trim() && passEl?.value.trim());
    if (btn) btn.disabled = !ok;
  };
  setTimeout(updateButtonState, 300);  // handles autofill
  codeEl?.addEventListener("input", updateButtonState);
  passEl?.addEventListener("input", updateButtonState);
  updateButtonState();

  // Enter key submits
  [codeEl, passEl].forEach(el=>{
    el?.addEventListener("keydown", (e)=>{
      if (e.key === "Enter") {
        e.preventDefault();
        btn?.click();
      }
    });
  });

  // ===== Login click =====
  btn?.addEventListener("click", async ()=>{
    if (btn.disabled) return;

    setBusy(true);
    setMsg("Checking…");

    const code = (codeEl?.value || "").trim().toUpperCase();
    const password = (passEl?.value || "").trim();
    if (!code || !password) {
      setBusy(false);
      setMsg("Please enter code and password.");
      return;
    }

    try {
      const body = new URLSearchParams({ code, password });

      const res = await fetch(WEBAPP_URL, {
        method: "POST",
        body // no custom headers → avoids CORS preflight
      });

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch { throw new Error("Server returned bad JSON"); }

      if (!data || !data.ok || !data.session) {
        throw new Error(data?.error || "Login failed");
      }

      // Normalize role casing and save via shared Auth (mspsbs_session)
      const sess = data.session || {};
      if (sess.role) sess.role = String(sess.role).toUpperCase();

      // ✅ Require UID (new auth identity)
      sess.uid = String(sess.uid || "").trim();
      if (!sess.uid) throw new Error("Account UID missing. Please contact admin.");

      // Clear old FT keys first (prevents stale values when switching users/roles)
      clearFtKeys();

      // Persist session (Auth.save writes mspsbs_session)
      Auth.save(sess);

      // Also persist FT info permanently in localStorage (blank strings allowed)
      if (sess.role === "FT") {
        try {
          localStorage.setItem("ms_level",     sess.level     ?? "");
          localStorage.setItem("ms_class",     sess.class     ?? "");
          localStorage.setItem("ms_anchor",    sess.anchor    ?? ""); // ✅ was ms_reviewid/sess.reviewid
          localStorage.setItem("ms_returnid",  sess.returnid  ?? "");
          localStorage.setItem("ms_profileid", sess.profileid ?? "");
        } catch {}
      }

      setMsg("Redirecting…");
      const target = Auth.routeFor(sess.role);
      console.log("SESSION ROLE:", sess.role, "→ ROUTE:", target);
      location.assign(target);

    } catch (err) {
      console.error(err);
      setMsg(String(err.message || err));
      setBusy(false);
    }
  });
})();
