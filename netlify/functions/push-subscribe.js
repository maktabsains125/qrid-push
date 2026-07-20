exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Method not allowed"
        })
      };
    }

    const body = JSON.parse(event.body || "{}");

    const mode = String(body.mode || "").trim();
    const code = String(body.code || "").trim().toUpperCase();
    const subscription = body.subscription || {};
    const deviceId = String(body.deviceId || "").trim();

    const GAS_URL =
      "https://script.google.com/macros/s/AKfycbwra1NxV5hDcTcV3sWOlwQwAR6292rgGWqpFxDndiESK9ai_ALlaPWsiIGWEgFaVXFA/exec";

    if (!code) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Missing code"
        })
      };
    }

    // ==========================
    // Save / Update subscription
    // ==========================
    if (mode === "savePushSubscription") {

      if (!deviceId) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ok: false,
            error: "Missing deviceId"
          })
        };
      }

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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "savePushSubscription",
          code,
          deviceId,
          subscription
        })
      });

      const text = await res.text();
      let data = {};

      try {
        data = JSON.parse(text);
      } catch (_) {
        data = {
          ok: false,
          error: "Bad GAS response",
          raw: text
        };
      }

      return {
        statusCode: data.ok ? 200 : 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      };
    }

    // ==========================
    // Deactivate subscription
    // ==========================
    if (mode === "deactivatePushSubscription") {

      if (!deviceId) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ok: false,
            error: "Missing deviceId"
          })
        };
      }

      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "deactivatePushSubscription",
          code,
          deviceId
        })
      });

      const text = await res.text();
      let data = {};

      try {
        data = JSON.parse(text);
      } catch (_) {
        data = {
          ok: false,
          error: "Bad GAS response",
          raw: text
        };
      }

      return {
        statusCode: data.ok ? 200 : 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      };
    }

    // Unknown mode
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: "Unknown mode"
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: String(err?.message || err)
      })
    };
  }
};
