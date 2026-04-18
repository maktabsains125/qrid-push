// netlify/functions/dailyreview.js
// Proxy to QRID DAILY REVIEW Apps Script webapp

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzbqYpcROcRdedzwW1U-t3z4pviMFN7fzbZGkdNG5_QABPAIEJEqSbXJrptG3jCU6jZ/exec";

exports.handler = async (event) => {
  // Handle CORS preflight just in case
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  try {
    const method = event.httpMethod || "GET";

    // Forward all query parameters
    const paramsObj = event.queryStringParameters || {};
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(paramsObj)) {
      if (value != null) searchParams.append(key, value);
    }

    const qs = searchParams.toString();
    const url = qs ? `${GAS_URL}?${qs}` : GAS_URL;

    const fetchOptions = { method };

    // For POST/PUT/etc, forward body as text/plain JSON
    if (method !== "GET" && method !== "HEAD") {
      fetchOptions.headers = {
        "Content-Type": "text/plain;charset=utf-8",
      };
      fetchOptions.body = event.body || "";
    }

    const res = await fetch(url, fetchOptions);
    const text = await res.text();

    const contentType =
      res.headers.get("Content-Type") ||
      "application/json; charset=utf-8";

    return {
      statusCode: res.status,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    console.error("dailyreview proxy error:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err),
      }),
    };
  }
};
