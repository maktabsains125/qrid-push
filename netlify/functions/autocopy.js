// netlify/functions/autocopy.js
// Proxy -> GAS Web App (AUTOCOPY page API)
// Injects { k: PROXY_KEY } into every request body.
// Supports:
//  - POST (preferred): body JSON -> GAS doPost
//  - GET passthrough (optional): forwards querystring -> GAS doGet

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbymMd30wGux1VtWxB-KUSwmU3XXusJ1vag7bwZWLzsEZbwoWLvXf_GW6n4GbLOG_zLr/exec";

// ✅ in appscript too
const PROXY_KEY = "autocopy_9F2KxA7PZLmQ_9iwR6HcV2Ypd71ya08kahtc";

function jsonOut(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(obj),
  };
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

exports.handler = async (event) => {
  try {
    const method = String(event.httpMethod || "GET").toUpperCase();

    // =========================
    // GET passthrough (optional)
    // =========================
    if (method === "GET") {
      const qs = event.rawQuery ? ("?" + event.rawQuery) : "";
      const res = await fetch(GAS_WEBAPP_URL + qs, { method: "GET" });
      const text = await res.text();

      // Try JSON; if not JSON, still return text
      const maybe = safeJsonParse(text);
      if (maybe) return jsonOut(res.status, maybe);

      return {
        statusCode: res.status,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
        body: text,
      };
    }

    // =========================
    // POST proxy (main path)
    // =========================
    if (method !== "POST") {
      return jsonOut(405, { ok: false, error: "Method not allowed" });
    }

    const incoming = safeJsonParse(event.body || "{}") || {};
    // Inject proxy key
    const payload = { ...incoming, k: PROXY_KEY };

    const res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    const json = safeJsonParse(text);

    if (!json) {
      // GAS returned non-JSON; wrap safely
      return jsonOut(res.status, { ok: false, error: "Non-JSON response from GAS", raw: text });
    }

    return jsonOut(res.status, json);
  } catch (err) {
    return jsonOut(500, { ok: false, error: String(err && err.message ? err.message : err) });
  }
};
