// netlify/functions/out-lvl.js
// Proxy to Apps Script for TRANS OUT
// - action=list     → JSON (filtered by level, for out-lvl.html page)
// - action=download → CSV passthrough (filtered by level)
// - action=attend   → redirect to Attendance page (list-out.html)

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyvbFHnQlBBvavpNHgsiRyZNfE9gkPtb_Y-MS6XN2Tu_ktNeXwHa8RxCiBEcJyzVAA2/exec";

exports.handler = async (event) => {
  try {
    // Build query string safely
    const paramsObj = event.queryStringParameters || {};
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(paramsObj)) {
      if (value != null) searchParams.append(key, value);
    }
    const qs = searchParams.toString();
    const url = qs ? `${GAS_URL}?${qs}` : GAS_URL;

    // Extract the action
    const action = (paramsObj.action || "list").toLowerCase();

    // ===== Attendance redirect =====
    // This enables: /.netlify/functions/out-lvl?action=attend
    // It will go straight to your static Attendance HTML page.
    if (action === "attend") {
      return {
        statusCode: 302,
        headers: {
          Location: "/shared/transfer/list/list-out/list-out.html",
        },
      };
    }

    // ===== Fetch Apps Script data =====
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    // ===== CSV passthrough =====
    if (action === "download") {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="TRANS_OUT.csv"',
          "Cache-Control": "no-store",
        },
        body: text,
      };
    }

    // ===== JSON from Apps Script =====
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          ok: false,
          error: "Invalid JSON from Apps Script",
          raw: text,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(json),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ok: false,
        error: err && err.message ? err.message : String(err),
      }),
    };
  }
};
