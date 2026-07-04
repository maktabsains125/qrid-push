const WEBAPP =
  "https://script.google.com/macros/s/AKfycbynuamGuCjHGDJllNyF8m7pGwLvtuTpfLRCs_dAv5fVe9Y9nHj1tz1uhA6XNYfXUEWd/exec";

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
