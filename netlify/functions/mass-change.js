// /.netlify/functions/mass-change.js
// Proxy to Apps Script webapp (keeps client code simple)

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxMrd7CwMJ25tUgJsBl37V0SKXcADniLsTziEuxWMnPXsmyayKaJNr9T-z5eOFu4q8/exec";

function toQuery(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const s = usp.toString();
  return s ? ("?" + s) : "";
}

exports.handler = async (event) => {
  try {
    const method = (event.httpMethod || "GET").toUpperCase();

    // Forward query string
    const qs = toQuery(event.queryStringParameters || {});
    const url = WEBAPP_URL + qs;

    // Body (handle base64)
    let body = event.body || "";
    if (event.isBase64Encoded) {
      body = Buffer.from(body, "base64").toString("utf8");
    }

    // Headers: keep it minimal + reliable
    const headers = {
      "Accept": "application/json,text/plain,*/*",
    };

    // If there's a body, send JSON content-type by default
    // (Your client mass-change.js sends JSON)
    if (method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] = "application/json; charset=utf-8";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: (method === "GET" || method === "HEAD") ? undefined : body,
    });

    const contentType = res.headers.get("content-type") || "application/json; charset=utf-8";
    const text = await res.text();

    return {
      statusCode: res.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
      body: text,
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }),
    };
  }
};
