// /.netlify/functions/class-info.js
// Proxy between frontend and Apps Script backend for CLASS PROFILES
//
// Supported calls from frontend:
//
//   GET  /.netlify/functions/class-info?mode=get&year=7
//   GET  /.netlify/functions/class-info?mode=total
//
//   POST /.netlify/functions/class-info
//        body: { mode:"save", year:"7", rows:[...] }
//
// This forwards to Apps Script Web App and returns JSON back.

export default async (req, context) => {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbzWryBmhjUBrLDPQ9SWjmIS2Jr-uMN_Q6U6L1bmb0jNG5VXkou6c8IHS3bMdMHKYjywXA/exec";

  try {
    const { method } = req;
    const urlObj = new URL(req.url);

    async function passGET() {
      // Keep the same querystring
      const forwardUrl = GAS_URL + urlObj.search;
      const r = await fetch(forwardUrl, { method:"GET" });
      const text = await r.text();
      return text;
    }

    async function passPOST() {
      // We just forward the body as-is to Apps Script.
      const bodyTxt = await req.text();
      const r = await fetch(GAS_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: bodyTxt
      });
      const text = await r.text();
      return text;
    }

    // Preflight for CORS if browser does OPTIONS
    if(method === "OPTIONS"){
      return new Response("",{
        status:200,
        headers:{
          "Access-Control-Allow-Origin":"*",
          "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
          "Access-Control-Allow-Headers":"Content-Type"
        }
      });
    }

    if(method === "GET"){
      const text = await passGET();
      return new Response(text,{
        status:200,
        headers:{
          "Content-Type":"application/json; charset=utf-8",
          "Access-Control-Allow-Origin":"*"
        }
      });
    }

    if(method === "POST"){
      const text = await passPOST();
      return new Response(text,{
        status:200,
        headers:{
          "Content-Type":"application/json; charset=utf-8",
          "Access-Control-Allow-Origin":"*"
        }
      });
    }

    // any other method:
    return new Response(JSON.stringify({ok:false,error:"Method not allowed"}),{
      status:405,
      headers:{
        "Content-Type":"application/json; charset=utf-8",
        "Access-Control-Allow-Origin":"*"
      }
    });

  } catch(err){
    return new Response(JSON.stringify({ok:false,error:String(err)}),{
      status:500,
      headers:{
        "Content-Type":"application/json; charset=utf-8",
        "Access-Control-Allow-Origin":"*"
      }
    });
  }
};
