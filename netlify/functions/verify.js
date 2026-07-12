// netlify/functions/verify.js
// Proxy -> Verify JWT GAS

const VERIFY_GAS_URL =
  "https://script.google.com/macros/s/AKfycbyp5OQFfpCq5udaUplhMigut81wzcEo-xN1vRcy8F55LKsWQAY1rw1Mreq0-sNjoAs4/exec";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

function json(statusCode, headers, obj) {
  return {
    statusCode,
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(obj)
  };
}

export async function handler(event) {

  const origin =
    event.headers?.origin ||
    event.headers?.Origin ||
    "*";

  const headers = corsHeaders(origin);

  // -----------------------------
  // OPTIONS
  // -----------------------------
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  // -----------------------------
  // POST only
  // -----------------------------
  if (event.httpMethod !== "POST") {
    return json(
      405,
      headers,
      {
        ok:false,
        error:"Method not allowed"
      }
    );
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  }
  catch(err){
    return json(
      400,
      headers,
      {
        ok:false,
        error:"Invalid JSON"
      }
    );
  }

  const token = String(body.token || "").trim();

  if (!token) {
    return json(
      400,
      headers,
      {
        ok:false,
        error:"Missing token"
      }
    );
  }

  try {

    const gasResponse = await fetch(
      VERIFY_GAS_URL,
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          token
        })
      }
    );

    const text = await gasResponse.text();

    let data;

    try{
      data = JSON.parse(text);
    }catch(err){
      return json(
        502,
        headers,
        {
          ok:false,
          error:"Bad response from Verify JWT GAS"
        }
      );
    }

    return json(
      200,
      headers,
      data
    );

  }
  catch(err){

    return json(
      500,
      headers,
      {
        ok:false,
        error:"Proxy error"
      }
    );

  }

}
