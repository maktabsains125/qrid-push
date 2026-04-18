// netlify/functions/adbook-netlify.js
// Proxy → Google Apps Script Web App for Admin Book / Greetings Settings
// Supports:
//   GET  ?mode=getAdminTable&session=AM|PM
//   GET  ?mode=getCounters
//   POST { mode:"updateCell", a1:"COUNTER!U12", value:"..." }

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyWbsO6QaJ0sQdfm76B7n9YjYV0avAs6hvckPca3WxOGlTz515S2_LzZLYE9flRC3HvDQ/exec";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "*";

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(origin), body: "" };
  }

  try {
    if (!GAS_URL || GAS_URL.includes("PASTE_")) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "GAS_URL not set in adbook-netlify.js" }),
      };
    }

    if (event.httpMethod === "GET") {
      const qs = event.queryStringParameters || {};
      const url = new URL(GAS_URL);
      for (const [k, v] of Object.entries(qs)) {
        if (v !== undefined && v !== null && String(v).length) {
          url.searchParams.set(k, String(v));
        }
      }

      const r = await fetch(url.toString(), { method: "GET" });
      const text = await r.text();

      return {
        statusCode: r.status,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        body: text,
      };
    }

    if (event.httpMethod === "POST") {
      const body = event.body || "{}";

      const r = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const text = await r.text();

      return {
        statusCode: r.status,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        body: text,
      };
    }

    return {
      statusCode: 405,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
    };
  }
}
