// netlify/functions/add-cls.js
// Proxy → Google Apps Script Web App (Add Classes to Database)

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzLM1EMioRvMxFHMAhdMiarYG7RFTiPa0IYEyf2voYFrtZ0tp7J8pQlQiK7nblsTF88/exec";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "*";

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(origin), body: "" };
  }

  // Only POST for this function
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    if (!GAS_URL) {
      return {
        statusCode: 500,
        headers: corsHeaders(origin),
        body: JSON.stringify({ ok: false, error: "GAS_URL is not configured" }),
      };
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      payload = {};
    }

    // Force correct mode (so frontend doesn't need to send it)
    payload.mode = "addClassesToDatabase";

    const r = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await r.text();

    return {
      statusCode: r.status,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: err.message || String(err) }),
    };
  }
}
