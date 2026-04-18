// /.netlify/functions/pw-manager
// Proxy: browser ↔ Netlify (same origin) ↔ Apps Script

export default async (req, context) => {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxRR7CRytVl_LyGQOgWoYTU5EFjE4OROagY5BpHVWU70gPSiuw_kZLmA1LYEcNa_dEd/exec";

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  try {
    if (req.method === "POST") {
      // pass body straight through
      const bodyText = await req.text();
      console.log("[pw-manager] FORWARD POST →", GAS_URL, bodyText);

      const r = await fetch(GAS_URL, {
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

    // Anything else (GET etc) is now blocked on purpose
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Method not allowed (use POST)"
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "proxy_fail",
        detail: String(err)
      }),
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
