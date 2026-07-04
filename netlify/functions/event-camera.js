const WEBAPP =
  "https://script.google.com/macros/s/AKfycbwq9pnHvBYuEOTFRD1UOYzdCF2sOCrJmJsSXdIFH-8KH-bQl7qBMK7zYYXlP8dEiwqk/exec";

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        message: "Method Not Allowed"
      })
    };
  }

  try {

    const body = JSON.parse(event.body || "{}");

    const response = await fetch(WEBAPP, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json"
      },
      body: text
    };

  } catch (err) {

    console.error(err);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: false,
        message: err.message
      })
    };

  }

};
