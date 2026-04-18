// /netlify/functions/ft-contacts.js
// Minimal proxy to GAS, so browser can call same-origin
export default async (req, context) => {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbztvNml6oSJBJoqegwO_a-pgmnO1Zyp72dna_x6YvEj1mtt-LKwhIDOwP1e6343koLp/exec";

  try {
    // Allow CORS for browser fetch if needed
    if (req.method === "OPTIONS") {
      return new Response("", {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ ok:false, error:"Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Forward query string (?year=7 etc.)
    const qs = req.url.includes("?") ? req.url.split("?")[1] : "";
    const url = qs ? `${GAS_URL}?${qs}` : GAS_URL;

    const r = await fetch(url, { method: "GET" });
    const data = await r.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type":"application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ ok:false, error:String(err) }),
      {
        status: 500,
        headers: { "Content-Type":"application/json" }
      }
    );
  }
};
