// netlify/functions/trends.js
// Proxy → GAS "Attendance Trends" web app

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyvFf5iGYKg-SwVlHjS6O5Q3RP8yKy-24IqHOP7rrf8Ec-Me2RLFKZoOx9tRpoxww/exec";

exports.handler = async (event) => {
  try {
    const paramsObj = event.queryStringParameters || {};
    const searchParams = new URLSearchParams();

    // Forward any query params (e.g. ?t=timestamp, ?callback=...)
    for (const [key, value] of Object.entries(paramsObj)) {
      if (value != null) searchParams.append(key, value);
    }

    const qs = searchParams.toString();
    const url = qs ? `${GAS_URL}?${qs}` : GAS_URL;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/javascript",
      },
    });

    const text = await res.text();

    // Decide content-type: JSON or JS (for JSONP)
    let contentType = "application/json; charset=utf-8";
    try {
      JSON.parse(text); // if this fails, we treat as JS
    } catch {
      contentType = "application/javascript; charset=utf-8";
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
      body: text,
    };
  } catch (err) {
    console.error("trends proxy error:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ ok: false, error: String(err) }),
    };
  }
};
