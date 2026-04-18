exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Method not allowed" })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const mode = String(body.mode || "").trim();
    const code = String(body.code || "").trim();
    const subscription = body.subscription || {};

    const GAS_URL = "https://script.google.com/macros/s/AKfycbwSJCVKS5TOjXd_3C--O3xmBDxuopeX4TCxksx8mnc_LtDvSq1K4krIBubw85UptEzf/exec";

    if (!code) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Missing code" })
      };
    }

    if (mode === "savePushSubscription") {
      if (
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth
      ) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ok: false,
            error: "Missing subscription keys"
          })
        };
      }

      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "savePushSubscription",
          code,
          subscription
        })
      });

      const text = await res.text();
      let data = {};

      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { ok: false, error: "Bad GAS response", raw: text };
      }

      return {
        statusCode: data.ok ? 200 : 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      };
    }

    if (mode === "checkPushSubscription") {
      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "checkPushSubscription",
          code
        })
      });

      const text = await res.text();
      let data = {};

      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { ok: false, error: "Bad GAS response", raw: text };
      }

      return {
        statusCode: data.ok ? 200 : 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      };
    }

    if (mode === "deactivatePushSubscription") {
      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "deactivatePushSubscription",
          code
        })
      });

      const text = await res.text();
      let data = {};

      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { ok: false, error: "Bad GAS response", raw: text };
      }

      return {
        statusCode: data.ok ? 200 : 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      };
    }

    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Unknown mode" })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: String(err && err.message ? err.message : err)
      })
    };
  }
};
