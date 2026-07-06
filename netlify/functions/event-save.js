// /.netlify/functions/event-save.js

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        message: "Method not allowed."
      })
    };
  }

  try {

    const body = JSON.parse(event.body || "{}");

    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbw5x4M6V65vTlbx9_25GIl2Wi7MfuG6CqeoF_mEvJPpu2Let5b4eAv6vQgFRiDfV5TfiQ/exec",
      {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          action: "saveEvent",

          user: body.user || ""

        })

      }
    );

    const text = await response.text();

    let data;

    try {

      data = JSON.parse(text);

    } catch {

      return {

        statusCode: 500,

        body: JSON.stringify({

          success: false,
          message: "Invalid JSON returned from GAS.",
          raw: text

        })

      };

    }

    return {

      statusCode: response.ok ? 200 : response.status,

      headers: {

        "Content-Type": "application/json"

      },

      body: JSON.stringify(data)

    };

  }

  catch (err) {

    return {

      statusCode: 500,

      body: JSON.stringify({

        success: false,

        message: err.message

      })

    };

  }

};
