const webpush = require("web-push");

const GAS_URL = "https://script.google.com/macros/s/AKfycbwra1NxV5hDcTcV3sWOlwQwAR6292rgGWqpFxDndiESK9ai_ALlaPWsiIGWEgFaVXFA/exec";

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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "getTomorrowGreetingPushList"
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

      console.log("No greeting duties for tomorrow.");

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ok: true,
          total: 0,
          sent: 0,
          failed: 0,
          message: "No greeting duties for tomorrow."
        })
      };
    }

    const results = await Promise.allSettled(
      rows.map(async (row) => {

        const payload = JSON.stringify({
          title: "Greeting duty tomorrow",
          body: `Reminder: ${row.gate} • ${row.shift} tomorrow.`,
          url: "/shared/camera/greetings/bookings.html",
          tag: `greeting-${row.code}-${data.dateKey}`
        });

        await webpush.sendNotification(
          row.subscription,
          payload
        );

        return row.code;

      })
    );

    let sent = 0;
    let failed = 0;

    const successUsers = [];
    const failedUsers = [];

    for (let i = 0; i < results.length; i++) {

      const result = results[i];
      const row = rows[i];

      if (result.status === "fulfilled") {

        sent++;

        successUsers.push({
          code: row.code,
          gate: row.gate,
          shift: row.shift,
          retried: false
        });

        continue;
      }

      const firstErr = result.reason;

      console.warn(
        `Retrying ${row.code}...`,
        firstErr?.statusCode || firstErr?.message || firstErr
      );

      try {

        const payload = JSON.stringify({
          title: "Greeting duty tomorrow",
          body: `Reminder: ${row.gate} • ${row.shift} tomorrow.`,
          url: "/shared/camera/greetings/bookings.html",
          tag: `greeting-${row.code}-${data.dateKey}`
        });

        await webpush.sendNotification(
          row.subscription,
          payload
        );

        sent++;

        successUsers.push({
          code: row.code,
          gate: row.gate,
          shift: row.shift,
          retried: true
        });

        console.log(`Retry succeeded: ${row.code}`);

      } catch (retryErr) {

        failed++;

        failedUsers.push({
          code: row.code,
          gate: row.gate,
          shift: row.shift,
          status: retryErr?.statusCode || "",
          error: retryErr?.message || String(retryErr)
        });

        console.error(
          `Retry failed: ${row.code}`,
          retryErr?.statusCode || retryErr?.message || retryErr
        );

        // Future improvement:
        // if (retryErr?.statusCode === 404 || retryErr?.statusCode === 410) {
        //   Call GAS to deactivate this deviceId.
        // }

      }

    }

    console.log("====================================");
    console.log("TOMORROW PUSH NOTIFICATION SUMMARY");
    console.log("====================================");
    console.log(`Total : ${rows.length}`);
    console.log(`Sent  : ${sent}`);
    console.log(`Failed: ${failed}`);
    console.log("");

    console.log("Successful users:");
    console.table(successUsers);

    console.log("Failed users:");
    console.table(failedUsers);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: true,
        total: rows.length,
        sent,
        failed,
        successUsers,
        failedUsers
      })
    };

  } catch (err) {

    console.error(err);

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
