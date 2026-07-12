/* ==========================================
   auth-check.js
   Shared JWT verification
   ========================================== */

const AuthCheck = (() => {

  const CACHE_KEY = "mspsbs_verified";
  const CACHE_MS  = 2 * 60 * 60 * 1000;   // 2 hours

  // ==========================================
  // Verify JWT with server
  // ==========================================
  async function verify(force = false) {

    // Auth helper must exist
    if (!window.Auth) {
      location.replace("/");
      return null;
    }

    // Local session must exist
    const who = Auth.who();

    if (!who || !who.token) {
      Auth.clear();
      localStorage.removeItem(CACHE_KEY);
      location.replace("/");
      return null;
    }

    // ------------------------------------------
    // Use cached verification
    // ------------------------------------------

    if (!force) {

      try {

        const cached = JSON.parse(
          localStorage.getItem(CACHE_KEY) || "null"
        );

        if (
          cached &&
          cached.verified &&
          cached.uid === who.uid &&
          cached.token === who.token &&
          (Date.now() - cached.checkedAt) < CACHE_MS
        ) {
          return cached;
        }

      } catch (_) {
        localStorage.removeItem(CACHE_KEY);
      }

    }

    // ------------------------------------------
    // Ask server
    // ------------------------------------------

    try {

      const res = await fetch("/.netlify/functions/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: who.token
        })
      });

      const data = await res.json();

      if (!data.ok || !data.verified) {

        Auth.clear();
        localStorage.removeItem(CACHE_KEY);

        location.replace("/");

        return null;
      }

      // ------------------------------------------
      // Refresh local session with verified values
      // ------------------------------------------

      const session = Auth.who();

      if (session) {

      session.role = data.role;
      session.uid  = data.uid;
      session.code = data.code;

      localStorage.setItem(
      "mspsbs_session",
      JSON.stringify(session)
     );

}

      // ------------------------------------------
      // Save cache
      // ------------------------------------------

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          ...data,
          token: who.token,
          checkedAt: Date.now()
        })
      );

      return data;

    } catch (err) {

      console.error(err);

      Auth.clear();
      localStorage.removeItem(CACHE_KEY);

      location.replace("/");

      return null;
    }

  }

  // ==========================================
  // Require one of these roles
  // ==========================================

  async function requireRole(...allowedRoles) {

    const verified = await verify();

    if (!verified) {
      return null;
    }

    const role = String(verified.role || "")
      .toUpperCase()
      .trim();

    const allowed = allowedRoles.map(r =>
      String(r).toUpperCase().trim()
    );

    if (!allowed.includes(role)) {

      if (window.Auth && typeof Auth.routeFor === "function") {
        location.replace(Auth.routeFor(role));
      } else {
        location.replace("/");
      }

      return null;
    }

    return verified;

  }

  // ==========================================
  // Force re-verification
  // ==========================================

  async function refresh() {
    return verify(true);
  }

  // ==========================================
  // Clear verification cache
  // ==========================================

  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
  }

  return {
    verify,
    requireRole,
    refresh,
    clearCache
  };

})();
