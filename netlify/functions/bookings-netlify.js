// netlify/functions/bookings-netlify.js
// Proxy → Google Apps Script Web App

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxcCW3GPrw3dyH0GEsoVvT0G7c3sfotdJUWU-RaNxE6_tlTSUiK_cDGfB8cHWVr1jFEeQ/exec";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json",
  };
}

function buildQueryFromEvent(event) {
  // Preferred: rawUrl
  try {
    if (event.rawUrl) {
      const url = new URL(event.rawUrl);
      return url.searchParams.toString();
    }
  } catch (_) {}

  // Fallback: queryStringParameters
  const q = event.queryStringParameters || {};
  const usp = new URLSearchParams();
  Object.keys(q).forEach((k) => {
    if (q[k] !== undefined && q[k] !== null) usp.set(k, String(q[k]));
  });
  return usp.toString();
}

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(origin), body: "" };
  }

  try {
    if (!GAS_URL) {
      return {
        statusCode: 500,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: false, error: "GAS_URL not set" }),
      };
    }

    if (event.httpMethod === "GET") {
      const qs = buildQueryFromEvent(event);
      const target = GAS_URL + (qs ? "?" + qs : "");

      const res = await fetch(target, { method: "GET" });
      const text = await res.text();

      return { statusCode: 200, headers: corsHeaders(origin), body: text };
    }

    if (event.httpMethod === "POST") {
      const body = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf8")
        : (event.body || "{}");

      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const text = await res.text();
      return { statusCode: 200, headers: corsHeaders(origin), body: text };
    }

    return {
      statusCode: 405,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: String(err.message || err) }),
    };
  }
}
