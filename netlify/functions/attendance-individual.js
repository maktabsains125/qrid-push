// netlify/functions/attendance-individual.js
const GAS_URL = "https://script.google.com/macros/s/AKfycby1EUPjDbwpS3R4iunbM7SBN5Puvhs9uiES2DR9_q1NUmTb8P3bdjbFnzEkJBDTURTZ/exec";
const DEFAULT_SPREADSHEET_ID = "1FcCiq4Zx1ec8oD38BGKyB4fP8te-MioniO4FV5QNauw";
const PASS = new Set(["sheet", "id", "cache", "callback"]);

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const url = new URL(GAS_URL);
    for (const k of Object.keys(qs)) if (PASS.has(k)) url.searchParams.set(k, qs[k]);
    if (!url.searchParams.get("id"))
      url.searchParams.set("id", DEFAULT_SPREADSHEET_ID);

    const r = await fetch(url.toString());
    const text = await r.text();
    const ct = r.headers.get("content-type") || "application/json";

    return {
      statusCode: r.status,
      headers: {
        "Content-Type": ct,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: String(err.message || err) }),
    };
  }
};
