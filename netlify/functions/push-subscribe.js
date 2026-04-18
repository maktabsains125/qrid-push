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
    const { code, subscription } = body;

    if (
      !code ||
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Missing code or subscription keys"
        })
      };
    }

    const GAS_URL = "https://script.google.com/macros/s/AKfycbw3li4Y6jkFsznzz1tqbfBubVDI9b1K5C58GcAPV4N18RzRpd3HGzQLUnbUJcOzbbk/exec";

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
