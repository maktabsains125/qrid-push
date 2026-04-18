// netlify/functions/reports-btn.js
// Proxy → Google Apps Script Web App (REPORTS BTN)
//
// GET  /.netlify/functions/reports-btn?mode=getAll
// POST /.netlify/functions/reports-btn  JSON: { mode:"set", key:"archive", enabled:1 }
//
// Security:
// - Injects proxy secret `k` from env var QRID_PROXY_KEY
// - Forces `by:"CODER"` and rejects any other value client tries to send
// - Keeps keys whitelist

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzGW-9iy4ljr5OOsb82hzWerFKwx-if6pwbChGzyt9F00GzX2BKfJhkpcs73xChsah0/exec";

const PROXY_KEY = process.env.QRID_PROXY_KEY || ""; // set in Netlify env vars

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

function safeJson(body) {
  try { return body ? JSON.parse(body) : {}; }
  catch { return null; }
}

function json(statusCode, origin, obj) {
  return {
    statusCode,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

function isAllowedKey(k) {
  // ✅ add new keys here
  return ["archive", "basicNames", "addCls", "massChange", "autocopy", "holiday", "userControl", "manual"].includes(k);
}


export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin), body: "" };
  }

  // -------- GET --------
  if (event.httpMethod === "GET") {
    const mode = String(event.queryStringParameters?.mode || "").trim();
    if (!mode) return json(400, origin, { ok: false, error: "Missing mode" });
    if (mode !== "getAll") return json(400, origin, { ok: false, error: "Invalid mode" });

    const url = `${GAS_URL}?mode=${encodeURIComponent(mode)}`;

    try {
      const res = await fetch(url, { method: "GET" });
      const text = await res.text();
      const data = safeJson(text);

      if (!data) return json(502, origin, { ok: false, error: "Bad JSON from GAS", raw: text.slice(0, 300) });

      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(data),
      };
    } catch (err) {
      return json(500, origin, { ok: false, error: String(err?.message || err || "Fetch failed") });
    }
  }

  // -------- POST (set) --------
  if (event.httpMethod === "POST") {
    if (!PROXY_KEY) {
      return json(500, origin, { ok: false, error: "Server missing QRID_PROXY_KEY env var" });
    }

    const body = safeJson(event.body);
    if (!body) return json(400, origin, { ok: false, error: "Bad JSON" });

    const mode = String(body.mode || "").trim();
    const key = String(body.key || "").trim();
    const enabled = Number(body.enabled);

    if (mode !== "set") return json(400, origin, { ok: false, error: "Invalid mode" });
    if (!key || !isAllowedKey(key)) return json(400, origin, { ok: false, error: "Invalid key" });
    if (!(enabled === 0 || enabled === 1)) return json(400, origin, { ok: false, error: "enabled must be 0 or 1" });

    // ✅ force CODER-only (client cannot spoof)
    const payload = { mode: "set", key, enabled, by: "CODER", k: PROXY_KEY };

    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const data = safeJson(text);

      if (!data) return json(502, origin, { ok: false, error: "Bad JSON from GAS", raw: text.slice(0, 300) });

      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(data),
      };
    } catch (err) {
      return json(500, origin, { ok: false, error: String(err?.message || err || "Fetch failed") });
    }
  }

  return json(405, origin, { ok: false, error: "Method not allowed" });
}
