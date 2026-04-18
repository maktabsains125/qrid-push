// netlify/functions/trans-out.js (CommonJS - safest)
// Proxy to Google Apps Script Web App

exports.handler = async (event) => {
  try {
    const GAS_URL =
      process.env.GAS_TRANS_OUT_URL ||
      "https://script.google.com/macros/s/AKfycbwbKQkcLMVDxkrLlLyipGM013cChM45E2wEwnF32dHccg7DAjesIb__E-VXg_mCv_v99Q/exec";

    const method = (event.httpMethod || "GET").toUpperCase();

    // ---- Debug ping ----
    const qs = event.queryStringParameters || {};
    if (method === "GET" && qs.mode === "ping") {
      return json(200, {
        ok: true,
        msg: "Netlify function is alive",
        hasEnv: !!process.env.GAS_TRANS_OUT_URL,
        gasUrlPreview: GAS_URL.slice(0, 45) + "..."
      });
    }

    if (method === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders(), body: "" };
    }

    if (method === "GET") {
      const query = new URLSearchParams(qs).toString();
      const target = query ? `${GAS_URL}?${query}` : GAS_URL;

      console.log("GET -> GAS:", target);

      const r = await fetch(target, {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      const text = await r.text();

      // If GAS returns HTML (common when not deployed правильно), surface it
      const looksLikeHtml = /^\s*</.test(text);
      if (!r.ok || looksLikeHtml) {
        console.log("Upstream non-JSON:", text.slice(0, 200));
        return json(500, {
          ok: false,
          error: "Upstream GAS did not return JSON",
          status: r.status,
          preview: text.slice(0, 300),
          target
        });
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" },
        body: text
      };
    }

    if (method === "POST") {
      const bodyText = event.body || "{}";

      console.log("POST -> GAS:", GAS_URL, "body size:", bodyText.length);

      const r = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: bodyText
      });

      const text = await r.text();

      const looksLikeHtml = /^\s*</.test(text);
      if (!r.ok || looksLikeHtml) {
        console.log("Upstream non-JSON:", text.slice(0, 200));
        return json(500, {
          ok: false,
          error: "Upstream GAS did not return JSON",
          status: r.status,
          preview: text.slice(0, 300)
        });
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" },
        body: text
      };
    }

    return json(405, { ok: false, error: `Method not allowed: ${method}` });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj)
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };
}
