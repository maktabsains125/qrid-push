// netlify/functions/basic-names.js
// Proxies: Frontend -> Netlify -> GAS Web App

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, log: ["Method not allowed. Use POST."] }),
      };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      body = {};
    }

    const action = String(body.action || "addBasicNamesOne").trim(); // ✅ keep what UI asked for
    const level = String(body.level || "").trim();

    // ✅ allow the actions your GAS supports
    const allowedActions = new Set(["addBasicNames", "addBasicNamesOne"]);
    if (!allowedActions.has(action)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, log: [`Invalid action: ${action}`] }),
      };
    }

    // ✅ level validation only needed when using addBasicNamesOne
    // If using addBasicNames (all levels), ignore level.
    if (action === "addBasicNamesOne") {
      const allowedLevels = new Set(["7", "8", "9", "10", "12", "13"]);
      if (!allowedLevels.has(level)) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ok: false, log: [`Invalid level: ${level}`] }),
        };
      }
    }

    // ✅ GAS WEB APP
    const GAS_WEBAPP_URL =
      "https://script.google.com/macros/s/AKfycbx7OokisK8jwrAKvcqZqQlWWAfshVXw-j-zGgS4d7qleOkRzT9iWrhA_qBTqN0rl_afHg/exec";

    // ✅ send exactly what GAS expects
    const payload =
      action === "addBasicNames"
        ? { action } // run all levels
        : { action, level }; // run one level

    const resp = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      // ✅ CRITICAL: must be application/json for your GAS parsePost_()
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, log: ["Non-JSON response from GAS:", text] };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        log: ["ERROR: " + (err?.message || String(err))],
      }),
    };
  }
}
