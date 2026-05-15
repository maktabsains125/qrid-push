// netlify/functions/camera.js
// Proxy to Apps Script CAMERA_WEBAPP_URL with no-cache + passthrough auth.
//
// CHANGE:
// - mode=config is still handled locally for speed
// - mode=ping is NO LONGER handled locally
// - mode=ping is now forwarded to GAS so warm-camera warms both Netlify and GAS

import { CAMERA_WEBAPP_URL, ORIGIN } from "./_camera-config.js";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  };
}

function jsonHeaders() {
  return {
    ...corsHeaders(),
    "content-type": "application/json; charset=utf-8",
  };
}

export async function handler(event) {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: "",
    };
  }

  // Method gate
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: jsonHeaders(),
      body: JSON.stringify({
        ok: false,
        error: "Method not allowed",
      }),
    };
  }

  const qs = event.queryStringParameters || {};
  const mode = String(qs.mode || "config").toLowerCase();

  const contentType =
    event.headers?.["content-type"] ||
    event.headers?.["Content-Type"] ||
    "application/json; charset=utf-8";

  const auth =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";

  let body;
  if (event.httpMethod === "POST") {
    body = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : (event.body || "");
  }

  // Keep config local for speed
  if (mode === "config") {
    const LOCAL_CONFIG = {
      ok: true,
      build: "local-config",
      sessions: {
        AM: { windowStart: "06:25", windowEnd: "08:00", lateCutoff: "07:31" },
        PM: { windowStart: "11:25", windowEnd: "14:00", lateCutoff: "13:01" },
      },
    };

    return {
      statusCode: 200,
      headers: jsonHeaders(),
      body: JSON.stringify(LOCAL_CONFIG),
    };
  }

  // mode=ping is intentionally forwarded to GAS

  const url =
    `${CAMERA_WEBAPP_URL}?mode=${encodeURIComponent(mode)}&origin=${encodeURIComponent(ORIGIN)}`;

  const ctrl = new AbortController();
  const timeoutMs = 20000;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: event.httpMethod,
      headers: {
        "content-type": contentType,
        ...(auth ? { authorization: auth } : {}),
      },
      ...(event.httpMethod === "POST" ? { body } : {}),
      signal: ctrl.signal,
    });

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: jsonHeaders(),
      body: text,
    };
  } catch (err) {
    const isAbort = String(err?.name || "").toLowerCase() === "aborterror";

    return {
      statusCode: 502,
      headers: jsonHeaders(),
      body: JSON.stringify({
        ok: false,
        error: isAbort
          ? `Proxy fetch timeout after ${timeoutMs}ms`
          : "Proxy fetch failed: " + String(err?.message || err),
      }),
    };
  } finally {
    clearTimeout(timer);
  }
}
