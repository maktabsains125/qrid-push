// SIMPLE VERSION (no npm, no xlsx)

const GAS_URL = "https://script.google.com/macros/s/AKfycbwAGMTiZT0BGbx8wCPgiGh0MoAAcWu49osVyQFm6YQXilNIPCg_iGqBNjoO0tCziGEcvA/exec";

function qs(obj) {
  return Object.entries(obj)
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

exports.handler = async (event) => {
  try {
    const p = event.queryStringParameters || {};

    const type  = p.type;
    const level = p.level;

    if (!type || !level) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok:false, error:"Missing params" })
      };
    }

    const url = `${GAS_URL}?${qs({
      action: "list",
      type,
      level
    })}`;

    const r = await fetch(url);
    const data = await r.text();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: data
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok:false, error:String(err) })
    };
  }
};
