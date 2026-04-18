// netlify/functions/individual.js
// Proxy → GAS WebApp for Individual Attendance
// modes: bootstrap | roster | student

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbz904XynVSEYkWxti_dhMQiMtw01g7Eoe4FjJsKKukVmGcbGZuiVKRVMH0y-8W3Sl6I/exec";

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};

    const sheet = params.sheet || "";
    const mode  = params.mode  || "";
    const sid   = params.sid   || "";
    const cls   = params.class || "";
    const id    = params.id    || "";   // Spreadsheet ID from front-end

    // Build upstream URL for GAS
    const url = new URL(ENDPOINT);

    if (sheet) url.searchParams.set("sheet", sheet);
    if (mode)  url.searchParams.set("mode", mode);
    if (cls)   url.searchParams.set("class", cls);
    if (sid)   url.searchParams.set("sid", sid);
    if (id)    url.searchParams.set("id", id);

    const res  = await fetch(url.toString(), { method: "GET" });
    const text = await res.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "GAS returned non-JSON",
          raw: text.slice(0, 200),
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(json),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
