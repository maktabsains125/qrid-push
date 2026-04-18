// No imports needed on Node >=18 (Netlify is Node 22)

// ---- CONFIG: paste your GAS Web App URL here ----
const GAS_URL = "https://script.google.com/macros/s/AKfycbyE69EaFm06beWc8n2LrwSt-i_WcmiES9NykDqaQJEXdxktJvY3YXxfiICaJfyG6-Jb/exec";
// --------------------------------------------------

/** CORS headers so the browser can call this function safely */
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Handle CORS preflight */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    // pass through the "s" (sheet) query, default to 7
    const year = (event.queryStringParameters && event.queryStringParameters.s) || "7";

    const url = new URL(GAS_URL);
    url.searchParams.set("s", year);

    const res = await fetch(url.toString(), { method: "GET" });
    const text = await res.text(); // GAS may send JSON with text/plain

    // Try to ensure JSON content-type for the browser
    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
    };
  }
}
