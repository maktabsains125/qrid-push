// netlify/functions/warm-camera.mjs

function isWarmWindowUtc(now = new Date()) {
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();

  // AM Brunei 06:20–08:00  => UTC 22:20–00:00
  const inAm =
    (h === 22 && m >= 20) ||
    h === 23 ||
    (h === 0 && m === 0);

  // PM Brunei 11:00–14:00 => UTC 03:00–06:00
  const inPm =
    (h >= 3 && h <= 5) ||
    (h === 6 && m === 0);

  return inAm || inPm;
}

export default async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    console.log("Scheduled invocation received", body);

    if (!isWarmWindowUtc()) {
      console.log("Outside warm window");
      return new Response("outside warm window", { status: 200 });
    }

    const base =
      process.env.URL ||
      "https://mspsbs-registration.netlify.app";

    const r = await fetch(
      `${base}/.netlify/functions/camera?mode=ping`,
      { method: "GET" }
    );

    const text = await r.text();
    console.log("Warm ping result:", text);

    return new Response(`warm ok: ${text}`, { status: 200 });
  } catch (e) {
    console.error("Warm failed:", e);
    return new Response(
      "warm failed: " + String(e?.message || e),
      { status: 500 }
    );
  }
};

export const config = {
  schedule: "*/4 * * * *"
};