// netlify/functions/current-user.js
export async function handler(event) {
  try {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbzkVh7AB3B6mZJ2wui_CHhuaZDhhR3MhD-8507vBiz6N1NYbimyH4oCNq059zh_hd5E/exec";
    const method = event.httpMethod || "GET";

    if (method === "GET") {
      const qs = event.queryStringParameters || {};
      const action = String(qs.action || "").trim();
      const code = String(qs.code || "").trim();

      const url = new URL(GAS_URL);
      if (action) url.searchParams.set("action", action);
      if (code) url.searchParams.set("code", code);

      const r = await fetch(url.toString(), { method: "GET" });
      const text = await r.text();

      return {
        statusCode: r.ok ? 200 : r.status,
        headers: { "Content-Type": "application/json" },
        body: text
      };
    }

    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const r = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const text = await r.text();

      return {
        statusCode: r.ok ? 200 : r.status,
        headers: { "Content-Type": "application/json" },
        body: text
      };
    }

    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method not allowed" })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) })
    };
  }
}
