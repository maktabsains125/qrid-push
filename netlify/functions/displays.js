// /netlify/functions/displays.js
export async function handler(event) {
  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbweXk4G5zF7cV-yjoQI5ecDOQChOeGxEyEqHf5tPNPLB5lfvV0HBYWiPmwyuSRrM8fp/exec";

  const baseHeaders = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=10, s-maxage=60, stale-while-revalidate=60",
    "keep-alive": "timeout=5",
  };

  const params  = event.queryStringParameters || {};
  const sheets  = params.sheets || "";
  const range   = params.range  || "B1:I21";
  const compact = params.compact ?? "1";
  const cache   = params.cache   ?? "20";

  const qs = new URLSearchParams({ sheets, range, compact, cache });

  const upstreamJSONP = `${WEBAPP_URL}?${qs.toString()}&callback=__x`;
  const upstreamJSON  = `${WEBAPP_URL}?${qs.toString()}`;

  async function fetchOnce(url, timeoutMs){
    const ac = new AbortController();
    const t  = setTimeout(()=>ac.abort(), timeoutMs);
    try {
      const res  = await fetch(url, { headers: { "User-Agent": "Netlify" }, signal: ac.signal });
      const text = await res.text();
      return { ok: true, text, status: res.status };
    } catch (err) {
      return { ok: false, err };
    } finally {
      clearTimeout(t);
    }
  }

  function parseMaybeJSONP(text){
    const m = text && text.match(/__x\(([\s\S]+?)\);?$/);
    if (m) return JSON.parse(m[1]);
    return JSON.parse(text); // try plain JSON
  }

  // Try JSONP, then JSON; if either fails due to cold start, wait and retry once.
  const TIMEOUT_MS_1 = 15000; // was 8000
  const TIMEOUT_MS_2 = 18000; // a bit longer for retry
  const RETRY_DELAY  = 800;   // backoff

  try {
    let first = await fetchOnce(upstreamJSONP, TIMEOUT_MS_1);
    if (!first.ok || !/^__x\(/.test(first.text)) {
      // Try plain JSON in case JSONP wasn’t honored
      first = await fetchOnce(upstreamJSON, TIMEOUT_MS_1);
    }

    if (!first.ok) {
      await new Promise(r=>setTimeout(r, RETRY_DELAY));
      let second = await fetchOnce(upstreamJSONP, TIMEOUT_MS_2);
      if (!second.ok || !/^__x\(/.test(second.text)) {
        second = await fetchOnce(upstreamJSON, TIMEOUT_MS_2);
      }
      if (!second.ok) throw second.err || new Error("Upstream unreachable");
      const json = parseMaybeJSONP(second.text);
      if (typeof json.ok !== "boolean") json.ok = true;
      return { statusCode: 200, headers: baseHeaders, body: JSON.stringify(json) };
    }

    const json = parseMaybeJSONP(first.text);
    if (typeof json.ok !== "boolean") json.ok = true;
    return { statusCode: 200, headers: baseHeaders, body: JSON.stringify(json) };

  } catch (err) {
    const msg = (err && err.message) || String(err);
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ ok:false, error: msg }) };
  }
}
