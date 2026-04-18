// Shared Kebab Menu – injects panel, wires actions, exposes open/close
// Works across all role dashboards

(function () {
  "use strict";

  const FRAGMENT_URL = "/shared/kebab/kebab.html";

  // public API attached to window
  const API = {
    open,
    close
  };

  // state
  let overlay, panel, btnClose, btnLogout, btnTask, btnBio;
  let isLoaded = false;
  let lastFocused = null;

  // preload on DOM ready
  document.addEventListener("DOMContentLoaded", ensureLoaded);

  async function ensureLoaded() {
    if (isLoaded) return;

    // fetch and inject kebab.html once
    const html = await fetch(FRAGMENT_URL, { cache: "no-cache" }).then(r => r.text());
    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();

    // take the root element from the fragment (the overlay)
    overlay = wrap.querySelector("[data-kebab-overlay]");
    if (!overlay) {
      console.error("[kebab] overlay root [data-kebab-overlay] not found in fragment");
      return;
    }
    document.body.appendChild(overlay);

    panel     = overlay.querySelector(".kebab-panel");
    btnClose  = overlay.querySelector("[data-kebab-close]");
    btnLogout = overlay.querySelector("[data-kebab-logout]");
    btnTask   = overlay.querySelector("[data-kebab-task]");
    btnBio    = overlay.querySelector("[data-kebab-biology]");

    // --- Safety guards ---
    if (!panel) {
      console.error("[kebab] .kebab-panel not found");
    }

    // Wire events
    // Close by clicking X
    if (btnClose) {
      btnClose.addEventListener("click", close);
    }

    // Close by clicking outside the panel
    overlay.addEventListener("click", (e) => {
      if (panel && !panel.contains(e.target)) close();
    });

    // ESC to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hasAttribute("hidden")) close();
    });

    // ===== Logout behavior (shared) =====
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        try {
          // 1) Remove ALL localStorage keys that start with "ms_"
          for (const k of Object.keys(localStorage)) {
            if (k.startsWith("ms_")) localStorage.removeItem(k);
          }

          // also clear mspsbs_session used by Auth.js
          localStorage.removeItem("mspsbs_session");

          // 2) Session storage (some apps stash short-lived state here)
          sessionStorage.clear();

          // 3) Possible cookies (only works for non-HttpOnly cookies set on JS-accessible path)
          const cookieNames = ["mspsbs_session", "ms_token", "ms_session", "ms_role", "ms_user"];
          const past = "Thu, 01 Jan 1970 00:00:00 GMT";
          cookieNames.forEach(name => {
            // root path
            document.cookie = `${name}=; expires=${past}; path=/`;
            // try also clearing on current path just in case
            document.cookie = `${name}=; expires=${past}; path=${location.pathname}`;
          });

          // 4) Let other tabs know (optional)
          try { localStorage.setItem("ms_logout_broadcast", String(Date.now())); } catch (_) {}

        } catch (e) {
          console.warn("Logout cleanup error:", e);
        }

        // 5) Redirect to login (cache-buster avoids bfcache restoring previous state)
        location.replace(`/?logout=${Date.now()}`);
      });
    }

    // ===== Task behavior – broadcast so each role page can respond later =====
    if (btnTask) {
      btnTask.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("kebab:task"));
        // Close panel after firing the event (optional)
        close();
      });
    }

    // ===== BioUnicorns visibility + behavior =====
    if (btnBio) {
      // Allowed user codes (uppercase)
      const ALLOWED_CODES = new Set([
        "SDR",
        "FTM",
        "HNN",
        "SFQ",
        "LEE",
        "DRN",
        "RNI",
        "IZY",
        "DAY",
        "SYS"
      ]);

      let code = "";
      try {
        if (window.Auth && typeof Auth.who === "function") {
          const who = Auth.who();  // { code, role, ... } or null
          if (who && who.code) {
            code = String(who.code).toUpperCase().trim();
          }
        }
      } catch (err) {
        console.warn("[kebab] error getting Auth.who() for BioUnicorns", err);
      }

      if (!ALLOWED_CODES.has(code)) {
        // Hide the button for non-whitelisted users
        btnBio.style.display = "none";
      } else {
        // Whitelisted: fire a custom event; pages decide what to do
        btnBio.addEventListener("click", () => {
          document.dispatchEvent(new CustomEvent("kebab:bio"));
          close();
        });
      }
    }

    isLoaded = true;
  }

  async function open() {
    await ensureLoaded();
    if (!overlay) return;
    lastFocused = document.activeElement;
    overlay.removeAttribute("hidden");
    // move focus for a11y
    if (panel) {
      panel.setAttribute("tabindex", "-1");
      panel.focus();
    }
  }

  function close() {
    if (!overlay) return;
    overlay.setAttribute("hidden", "");
    // return focus
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  // expose globally
  window.Kebab = API;
})();
