const GAS_URL = "https://script.google.com/macros/s/AKfycbwjcjk38J0kWtf5KeizM0sqMhneZGdOUrIEfiM9Nnr227ROgi7XqgDdNKiUNv3t2xaI/exec";

export async function handler(event, context) {
  try {
    if (!GAS_URL || GAS_URL.includes("PASTE_YOUR")) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok:false, error: "Configure GAS_URL in /.netlify/functions/full-attend.js" })
      };
    }

    // Forward query string (?s=7, etc.)
    const qs = event.rawQuery ? `?${event.rawQuery}` : "";
    const url = GAS_URL + qs;

    const res = await fetch(url, {
      method: "GET",
      headers: { "accept": "application/json" },
    });

    const text = await res.text();
    // Try to pass-through JSON, but fall back to text if needed.
    return {
      statusCode: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok:false, error: String(err && err.message || err) })
    };
  }
}
