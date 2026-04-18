const webpush = require("web-push");

const GAS_URL = "https://script.google.com/macros/s/AKfycbxq-saCqjN5D_7612zIo6hEQRyaGnC0tYjV3kLES53_gpyldseULenDiwUekXW9QYAp/exec";

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY");
}

webpush.setVapidDetails(
  "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async () => {
  try {
    const res = await fetchWithTimeout(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "getTodayGreetingPushList"
      })
    });

    const text = await res.text();
    let data = {};

    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error("Bad GAS response");
    }

    if (!data.ok) {
      throw new Error(data.error || "GAS error");
    }

    const rows = Array.isArray(data.rows) ? data.rows : [];

    if (!rows.length) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          total: 0,
          sent: 0,
          failed: 0,
          message: "No greeting duties for today."
        })
      };
    }

    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const payload = JSON.stringify({
          title: "Greeting duty today",
          body: `You have a greeting duty today for ${row.shift}`,
          url: "/shared/camera/greetings/bookings.html",
          tag: `greeting-${row.code}-${data.dateKey}`
        });

        await webpush.sendNotification(row.subscription, payload);
        return { code: row.code };
      })
    );

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const row = rows[i];

      if (result.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        const err = result.reason;
        console.error(
          "Push failed:",
          row.code,
          err && (err.statusCode || err.message || err)
        );

        // Optional future improvement:
        // if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        //   deactivate subscription in GAS sheet here
        // }
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        total: rows.length,
        sent,
        failed
      })
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