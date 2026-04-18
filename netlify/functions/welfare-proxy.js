// netlify/functions/welfare-proxy.js
// Server-side proxy to Apps Script Web App, to avoid browser CORS/JSONP issues.

const GAS_URL = "https://script.google.com/macros/s/AKfycbwWfFxiBI9t1tED-J1mYyAkVu0EXuf4AjzdkOBuQGWLjrkyVKWVXzaSWTPZxIn0Qa17/exec"; // 

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const url = new URL(GAS_URL);

    // Pass-through allowed query params
    for (const k of ["sheet","welfare","cache","callback"]) {
      if (qs[k] != null && qs[k] !== "") url.searchParams.set(k, qs[k]);
    }

    // Native fetch is available on Netlify Functions (Node 18+)
    const upstream = await fetch(url.toString(), { method: "GET" });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    return {
      statusCode: upstream.status,
      headers: {
        "Content-Type": contentType,
        // You’re same-origin now (/.netlify/functions/*), but keep CORS permissive anyway
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": qs.cache && Number(qs.cache) > 0
          ? `public, max-age=${Number(qs.cache)}`
          : "no-store",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ ok:false, error: String(err && err.message ? err.message : err) }),
    };
    }
};
