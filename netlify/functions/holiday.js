// /.netlify/functions/holiday
// Forward-proxy to GAS Holiday Web App

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxnmBxKpjun4UOB5CGKUwgTXic5BrhLxaOdTNhdi-24-jeFos55uJEFooxCtVoT9UKycg/exec";

exports.handler = async (event) => {
  // CORS / preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store",
      },
      body: "",
    };
  }

  try {
    const method = event.httpMethod || "GET";

    // Parse params
    let params = {};
    if (method === "GET") {
      params = event.queryStringParameters || {};
    } else {
      const ct =
        (event.headers && (event.headers["content-type"] || event.headers["Content-Type"])) || "";
      if (ct.includes("application/json")) {
        params = JSON.parse(event.body || "{}");
      } else {
        try { params = JSON.parse(event.body || "{}"); } catch { params = {}; }
      }
    }

    // Always POST to GAS
    const resp = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const text = await resp.text();

    return {
      statusCode: resp.status, // ✅ keep real status
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        ok: false,
        logs: ["Proxy error", String(err && err.stack ? err.stack : err)],
      }),
    };
  }
};
