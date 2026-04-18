// netlify/functions/regis-contacts.js
//
// Proxy for REGIS Contacts page
// - Forwards GET to your GAS web app
// - Returns JSON in same-origin so browser JS can fetch("/.netlify/functions/regis-contacts")
//
// Frontend lives at /shared/contacts/regis/
// regis.js expects { ok:true, rows:[ { role, code, fullName, phone }, ... ] }

export default async (req, context) => {
  // Your deployed Google Apps Script URL:
  const GAS_URL = "https://script.google.com/macros/s/AKfycbw2rF879w9pDsipBv9fOsfZtR_IL0IqfJ4Cntl3jksuNmtTIyJBSZcBMA9zg5i5fBygvA/exec";

  try {
    // Only allow GET (and OPTIONS for CORS preflight safety if you ever call cross-origin)
    if (req.method !== "GET" && req.method !== "OPTIONS") {
      return new Response(
        JSON.stringify({ ok:false, error:"Method not allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
          }
        }
      );
    }

    // Forward the request to GAS
    // REGIS API does not need query params, so just plain URL
    const upstreamRes = await fetch(GAS_URL, {
      method: "GET",
      // we don't forward headers/body because GAS doesn't need auth here
    });

    // Try to parse clean JSON first
    let data;
    let textBody;
    try {
      data = await upstreamRes.json();
    } catch (e) {
      // GAS sometimes returns HTML with the JSON at the end.
      // Fallback: read text, regex out { ... } block, parse that.
      textBody = textBody || (await upstreamRes.text());
      const m = textBody.match(/\{[\s\S]*\}$/);
      if (m) {
        data = JSON.parse(m[0]);
      } else {
        // couldn't parse at all
        return new Response(
          JSON.stringify({
            ok:false,
            error:"Upstream gave non-JSON",
            raw:textBody || "(no body)"
          }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json",
            }
          }
        );
      }
    }

    // Success path: return whatever GAS said
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          "Content-Type":"application/json",
          "Cache-Control":"no-store"
        }
      }
    );

  } catch (err) {
    // Network / runtime error
    return new Response(
      JSON.stringify({
        ok:false,
        error:String(err || "Unknown error")
      }),
      {
        status: 500,
        headers: {
          "Content-Type":"application/json"
        }
      }
    );
  }
};
