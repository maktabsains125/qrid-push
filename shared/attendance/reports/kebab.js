/* /shared/attendance/reports/kebab.js
 * Left kebab controller + radio gating + route guard (server state via Sheets)
 *
 * RULES:
 * - Only special role can toggle radios.
 * - CODER can always access (even if toggle OFF).
 * - If toggle ON: special role + REGIS can access.
 * - If toggle OFF: only special role can access.
 */

(function () {
  "use strict";

  const BTN_API = "/.netlify/functions/reports-btn";

  function getWho() {
    return (window.Auth && typeof Auth.who === "function") ? Auth.who() : null;
  }
  function norm(x) { return String(x || "").toUpperCase().trim(); }

  function getUser() {
    const who = getWho();
    if (!who) return null;
    return {
      role: norm(who.role),
      code: norm(who.code || who.teacher || who.id || "")
    };
  }

  function setRadioUI(iconEl, checked) {
    if (!iconEl) return;
    iconEl.textContent = checked ? "radio_button_checked" : "radio_button_unchecked";
  }

  function setLinkDisabled(linkEl, disabled) {
    if (!linkEl) return;
    if (disabled) {
      linkEl.classList.add("is-disabled");
      linkEl.setAttribute("aria-disabled", "true");
      linkEl.setAttribute("tabindex", "-1");
    } else {
      linkEl.classList.remove("is-disabled");
      linkEl.removeAttribute("aria-disabled");
      linkEl.removeAttribute("tabindex");
    }
  }

  function safeJsonParse(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  async function apiGetAll() {
    const url = BTN_API + "?mode=getAll";
    const res = await fetch(url, { method: "GET", credentials: "same-origin" });
    if (!res.ok) throw new Error("BTN_API network " + res.status);
    const json = await res.json();
    if (!json || !json.ok) throw new Error((json && json.error) || "BTN_API error");
    return json.data || {};
  }

  async function apiSet(key, enabled) {
    const payload = { mode: "set", key, enabled: enabled ? 1 : 0, by: "CODER" };

    const res = await fetch(BTN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    });

    if (!res.ok) throw new Error("BTN_API network " + res.status);
    const text = await res.text();
    const json = safeJsonParse(text);
    if (!json || !json.ok) throw new Error((json && json.error) || "BTN_API error");
    return true;
  }

  function enabledFromMap(map, key) {
    const v = map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : 0;
    return Number(v) === 1;
  }

  function isCoder(user) { return user && user.role === "CODER"; }
  function isRegis(user) { return user && user.role === "REGIS"; }

  // ===== route guard (target pages) =====
  async function guard(opts) {
    opts = opts || {};
    const user = getUser();
    if (!user) { location.replace("/"); return; }

    const key = String(opts.key || "").trim();
    const redirectTo = String(opts.redirectTo || "/shared/attendance/reports/reports.html");
    if (!key) { location.replace(redirectTo); return; }

    if (isCoder(user)) return;

    try {
      const map = await apiGetAll();
      const checked = enabledFromMap(map, key);

      if (!checked) { location.replace(redirectTo); return; }
      if (!isRegis(user)) { location.replace(redirectTo); return; }
    } catch (err) {
      console.error("[LeftKebab.guard] BTN API failed:", err);
      location.replace(redirectTo);
    }
  }

  // ===== menu init =====
  async function init(opts) {
    opts = opts || {};
    const user = getUser();
    if (!user) return;

    const canUseRadio = isCoder(user);

    const kebabBtn = document.getElementById("kebabBtn");
    const overlay  = document.getElementById("kebabOverlay");
    const closeBtn = document.getElementById("kebabClose");
    const dim      = document.getElementById("overlayDim");
    if (!kebabBtn || !overlay) return;

    function openMenu()  { overlay.hidden = false; }
    function closeMenu() { overlay.hidden = true; }

    // bind open
    const kb = kebabBtn.cloneNode(true);
    kebabBtn.replaceWith(kb);
    kb.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu();
    });

    // bind close
    if (closeBtn) {
      const cb = closeBtn.cloneNode(true);
      closeBtn.replaceWith(cb);
      cb.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      });
    }

    // dim closes
    if (dim) {
      dim.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      });
    } else {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeMenu();
      });
    }

    // Esc closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    // load server state
    let stateMap = {};
    try {
      stateMap = await apiGetAll();
    } catch (err) {
      console.error("[LeftKebab.init] BTN API failed:", err);
      stateMap = {};
    }

    const rows = Array.from(overlay.querySelectorAll(".kebab-row"));

    rows.forEach((row) => {
      const rowKey = String(row.getAttribute("data-key") || "").trim() || "item";

      const radioBtn  = row.querySelector(".radioToggle");
      const radioIcon = row.querySelector(".radioIcon");

      // IMPORTANT: robust link resolve
      const linkId = radioBtn ? radioBtn.getAttribute("data-for") : null;
      let linkEl =
        (linkId && document.getElementById(linkId)) ||
        row.querySelector("a.panel-item") ||
        row.querySelector("a");

      let checked = enabledFromMap(stateMap, rowKey);

      // radio button enabled only for CODER
      if (radioBtn) {
        if (!canUseRadio) {
          radioBtn.classList.add("is-disabled");
          radioBtn.setAttribute("aria-disabled", "true");
          radioBtn.setAttribute("tabindex", "-1");
        } else {
          radioBtn.classList.remove("is-disabled");
          radioBtn.removeAttribute("aria-disabled");
          radioBtn.removeAttribute("tabindex");
        }
      }

      setRadioUI(radioIcon, checked);
      applyLinkRule();

      // toggle (CODER only)
      if (radioBtn && canUseRadio) {
        radioBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const next = !checked;

          checked = next;
          setRadioUI(radioIcon, checked);
          applyLinkRule();

          try {
            await apiSet(rowKey, checked ? 1 : 0);
            stateMap[rowKey] = checked ? 1 : 0;
          } catch (err) {
            console.error("[LeftKebab] save failed:", err);

            checked = !checked;
            setRadioUI(radioIcon, checked);
            applyLinkRule();
            alert("Unable to save. Please try again.");
          }
        });
      }

      // block click when disabled
      if (linkEl) {
        linkEl.addEventListener("click", (e) => {
          if (linkEl.getAttribute("aria-disabled") === "true") {
            e.preventDefault();
            e.stopPropagation();
          }
        });
      }

      function applyLinkRule() {
        if (!linkEl) return;

        // CODER always can click
        if (isCoder(user)) {
          setLinkDisabled(linkEl, false);
          return;
        }

        // checked => allow REGIS only
        // unchecked => deny all
        if (checked) {
          setLinkDisabled(linkEl, !isRegis(user));
        } else {
          setLinkDisabled(linkEl, true);
        }
      }
    });

    return { openMenu, closeMenu, USER_ROLE: user.role };
  }

  window.LeftKebab = { init, guard };
})();
