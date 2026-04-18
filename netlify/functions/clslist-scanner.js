// netlify/functions/clslist-scanner.js
const GAS_URL = "https://script.google.com/macros/s/AKfycbxogOMJDVWdvFRETGhyqaYF2PCnEVUkRb3BZSZfvCAvjeDm9GwEVZHAOrCK-uMdpwlLDQ/exec";

exports.handler = async (event) => {
  try {
    const method = event.httpMethod || "GET";
    const qs = event.queryStringParameters || {};
    const q = new URLSearchParams(qs).toString();
    const url = q ? `${GAS_URL}?${q}` : GAS_URL;

    // decode body if needed
    let body = event.body || "";
    if (event.isBase64Encoded && body) {
      body = Buffer.from(body, "base64").toString("utf8");
    }

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: method === "POST" ? (body || JSON.stringify({})) : undefined,
    });

    const text = await res.text();

    return {
      statusCode: res.status, // IMPORTANT: don't force 200
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: String(err) }),
    };
  }
};
