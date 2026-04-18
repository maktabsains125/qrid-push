// netlify/functions/daily-reports-netlify.js
// Proxies Daily Reports calls to Apps Script Web App.
// Sends/receives JSON as text/plain (avoids preflight in most cases).

const DAILY_REPORTS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbw-PRBHlOrBTc9YVkz7QcRm-IAxKxCneQH1NHZH6A3JGXoDsZ00JlX8BWgxtgbHaT2X0A/exec";

// Allowlist (optional). Add domains as needed.
const ALLOW_ORIGINS = new Set([
  "https://mspsbs-registration.netlify.app",
]);

function corsHeaders(origin) {
  const o = origin || "";
  const allow =
    !o ? "*" :
    (ALLOW_ORIGINS.has(o) ? o : o); // fallback echo (keeps it working in same-origin proxies)

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin), body: "" };
  }

  try {
    const upstream = await fetch(DAILY_REPORTS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: event.body || "",
    });

    const text = await upstream.text();

    return {
      statusCode: upstream.status || 200,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json; charset=utf-8",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
    };
  }
};
