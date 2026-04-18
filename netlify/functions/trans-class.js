// netlify/functions/trans-class.js
// Proxy to Apps Script web app for TRANSFER CLASS

// Appscript
const GAS_URL = "https://script.google.com/macros/s/AKfycbwv4-stYab2pEjrqI9fDU9-EmC_oSwXxu-PMshS4nxqItFy9KR6UKv2g1ocDIb69gmP/exec";

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    const payload = event.body || "{}";

    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { ok: false, error: "Invalid JSON from GAS", raw: text };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err && err.message || String(err),
      }),
    };
  }
};
