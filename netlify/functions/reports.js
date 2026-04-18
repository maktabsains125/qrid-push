// netlify/functions/reports.js
// Proxy to Apps Script web app for DAILY & MONTHLY REPORTS

// Apps Script web app URL (JSON backend)
const GAS_URL = "https://script.google.com/macros/s/AKfycby_WodJPtREIEXKzFJJmY1tVckjECfaS5bWrlxCd4HUuriHh2JwUoSMT4dutHcDkcY0Sg/exec";

exports.handler = async (event, context) => {
  // We’ll use GET for this reports endpoint
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    // Pass through any query string to GAS, e.g. ?mode=getReports
    const query = event.rawQueryString ? `?${event.rawQueryString}` : "";

    const response = await fetch(GAS_URL + query, {
      method: "GET",
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { ok: false, error: "Invalid JSON from GAS", raw: text };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: (err && err.message) || String(err),
      }),
    };
  }
};
