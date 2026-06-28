// netlify/functions/list-out.js
// Proxies requests to Apps Script for TRANS OUT data

const GAS_URL = "https://script.google.com/macros/s/AKfycbwG415LvF_MdywUlTjcoCTLOns1wKsrrhzm93Q-P1GtqVnyhjkQVcjYkG314aURnMsr/exec";

exports.handler = async function(event) {
  try {
    const params = event.queryStringParameters || {};
    const search = new URLSearchParams(params);

    // Default action
    if (!search.has("action")) {
      search.set("action", "list");
    }

    const targetUrl = `${GAS_URL}?${search.toString()}`;
    const resp = await fetch(targetUrl);

    let data;

    try {
    data = await resp.json();
    } catch (e) {
     data = {
    ok: false,
    error: "Invalid JSON from Apps Script"
  };
}

    return {
      statusCode: 200,
      headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60"
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error("Netlify list-out error:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ ok: false, error: "Netlify function error" })
    };
  }
};
