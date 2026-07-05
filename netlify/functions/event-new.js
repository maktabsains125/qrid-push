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
      "https://script.google.com/macros/s/AKfycbwf4ys1IaTzC41bpRwP4oaRQTkBcnDqo_VghyKJN5rc09zTMC2HJCDdeoIK3z8OaWvddQ/exec",
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
