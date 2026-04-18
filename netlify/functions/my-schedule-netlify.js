// netlify/functions/my-schedule-netlify.js
// UID proxy → GAS Web App (UID version; no shared proxy secret)
// - CORS safe (OPTIONS)
// - POST only
// - Strict mode allowlist
// - Validates uid
// - Forwards only mode+uid to GAS
// - Safe JSON parsing + response sanity

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbymugHvqPkSsPoqtXIoxWGYX65P8dEkVOJjPGJ-9aupRUsXAH29Kck8x0mvptQX_36Xgw/exec";

const ALLOWED_MODE = "getMySchedule";

// Adjust if your UID format differs.
// This matches examples like UID_9ZK2M8Q1R6P0 or FTR_9ZK2...
const UID_RE = /^[A-Z]{2,5}_[A-Z0-9]{6,40}$/i;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

function safeJson(body) {
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return null;
  }
}

function json(statusCode, headers, obj) {
  return {
    statusCode,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
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

  // Parse JSON
  const payload = safeJson(event.body);
  if (!payload) {
    return json(400, headers, { ok: false, error: "Invalid JSON body" });
  }

  // Allow only exact mode
  const mode = String(payload.mode || "").trim();
  if (mode !== ALLOWED_MODE) {
    return json(400, headers, { ok: false, error: "Invalid mode" });
  }

  // Validate uid
  const uid = String(payload.uid || "").trim();
  if (!uid || !UID_RE.test(uid)) {
    return json(400, headers, { ok: false, error: "Invalid uid" });
  }

  // Forward only minimal fields to reduce attack surface
  const forwardBody = { mode: ALLOWED_MODE, uid };

  // Forward to GAS
  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardBody),
    });

    const text = await res.text();

    let outObj = null;
    try { outObj = JSON.parse(text); } catch {}

    if (!outObj) {
      return json(502, headers, { ok: false, error: "Bad response from server" });
    }

    // Keep statusCode as 200 so frontend always gets JSON body
    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(outObj),
    };
  } catch (err) {
    return json(500, headers, { ok: false, error: "Proxy error" });
  }
}
