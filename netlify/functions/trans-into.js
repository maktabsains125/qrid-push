// /.netlify/functions/trans-into.js
// Minimal proxy → Google Apps Script
// Supports:
//   GET  ?mode=getClasses&level=Year%208
//   POST ?mode=transferStudent  (JSON body)

export default async (req, context) => {
  const GAS_URL = "https://script.google.com/macros/s/AKfycby2cEcAsNWfrrcW6sXdA5eCHFeEr_z_RMwb__gNU0XWz6iw0gDNLZozp1UwZbb31nIz/exec";

  try {
    const { method, url } = req;
    const hasQuery = url.includes("?") ? url.split("?")[1] : "";
    const u = new URL(url);
    const mode = u.searchParams.get("mode") || "";

    // Handle CORS preflight if needed
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    // ===== GET /?mode=getClasses&level=Year%2010 =====
    if (method === "GET" && mode === "getClasses") {
      const forwardUrl = `${GAS_URL}?${hasQuery}`;
      const r = await fetch(forwardUrl, { method: "GET" });
      const text = await r.text(); // GAS returns JSON string

      return new Response(text, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // ===== POST /?mode=transferStudent =====
    if (method === "POST" && mode === "transferStudent") {
      const bodyText = await req.text();
      const forwardUrl = `${GAS_URL}?${hasQuery}`;

      const r = await fetch(forwardUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText
      });
      const text = await r.text();

      return new Response(text, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // ===== anything else =====
    return new Response(
      JSON.stringify({ ok: false, error: "Unsupported method/mode" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
};
