// netlify/functions/all-contacts.js
//
// Proxy for ALL Teachers Contacts
// Forwards request to GAS web app and returns JSON cleanly.

export default async (req, context) => {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbz9Zx-_tp35XTKn5eCOMMExY_xMWKCacKqmLgUQa_Edh6e2wQnXlDk5OePzAGSqNbzC_A/exec";

  try {
    if (req.method !== "GET" && req.method !== "OPTIONS") {
      return new Response(JSON.stringify({ ok:false, error:"Method not allowed" }), {
        status: 405,
        headers: { "Content-Type":"application/json" }
      });
    }

    const upstreamRes = await fetch(GAS_URL, { method: "GET" });

    let data;
    try {
      data = await upstreamRes.json();
    } catch {
      const txt = await upstreamRes.text();
      const m = txt.match(/\{[\s\S]*\}$/);
      data = m ? JSON.parse(m[0]) : { ok:false, error:"Invalid JSON", raw:txt };
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type":"application/json",
        "Cache-Control":"no-store"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok:false, error:String(err) }), {
      status: 500,
      headers: { "Content-Type":"application/json" }
    });
  }
};
