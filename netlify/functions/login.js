// netlify/functions/login.js
// Proxy → Google Apps Script Login Web App
// - CORS safe (OPTIONS)
// - POST only
// - Accepts JSON or form-encoded from browser
// - Forwards as form-encoded (avoids GAS CORS/preflight issues)
// - Restricts payload to { code, password }
// - Optional: adds server secret header (can be ignored by GAS)

const GAS_URL = "https://script.google.com/macros/s/AKfycbwB15CQU-4Cuj4Q1OQxRIepaMXhzVQpFrni3Nzs-V1KVNdkmbJKZbyasUjwh6jWYr3T/exec";

// Optional secret between Netlify and GAS (only useful if you also enforce it in GAS)
const PROXY_KEY = process.env.LOGIN_PROXY_KEY || ""; // set in Netlify env vars if you want

const CODE_RE = /^[A-Z0-9]{1,12}$/;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

function json(statusCode, headers, obj) {
  return {
    statusCode,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function parseBody(event) {
  const ct = String(event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();
  const body = event.body || "";

  // JSON
  if (ct.includes("application/json")) {
    try { return JSON.parse(body || "{}"); } catch { return null; }
  }

  // form-encoded
  if (ct.includes("application/x-www-form-urlencoded")) {
    try {
      const params = new URLSearchParams(body);
      return {
        code: params.get("code") || "",
        password: params.get("password") || "",
      };
    } catch {
      return null;
    }
  }

  // If browser sent no content-type, try best-effort:
  try { return JSON.parse(body || "{}"); } catch {}
  try {
    const params = new URLSearchParams(body);
    return {
      code: params.get("code") || "",
      password: params.get("password") || "",
    };
  } catch {}

  return null;
}

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "*";
  const headers = corsHeaders(origin);

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // POST only
  if (event.httpMethod !== "POST") {
    return json(405, headers, { ok: false, error: "Method not allowed" });
  }

  if (!GAS_URL) {
    return json(500, headers, { ok: false, error: "GAS_URL not set" });
  }

  const payload = parseBody(event);
  if (!payload) {
    return json(400, headers, { ok: false, error: "Invalid body" });
  }

  const code = String(payload.code || "").trim().toUpperCase();
  const password = String(payload.password || "");

  if (!CODE_RE.test(code)) {
    return json(400, headers, { ok: false, error: "Invalid code" });
  }
  if (!password) {
    return json(400, headers, { ok: false, error: "Missing password" });
  }

  // Forward to GAS as form-encoded (works nicely with doPost(e.parameter...))
  const forward = new URLSearchParams({ code, password }).toString();

  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        ...(PROXY_KEY ? { "X-LOGIN-PROXY-KEY": PROXY_KEY } : {}),
      },
      body: forward,
    });

    const text = await res.text();

    // Normalize output to JSON (GAS usually returns JSON text)
    let data = null;
    try { data = JSON.parse(text); } catch {}

    if (!data) {
      return json(502, headers, { ok: false, error: "Bad response from login server" });
    }

    // Pass through (keep status 200 so frontend can read body)
    return json(200, headers, data);

  } catch (err) {
    return json(500, headers, { ok: false, error: "Proxy error" });
  }
}
