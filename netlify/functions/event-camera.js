const CAMERA_WEBAPP =
  "https://script.google.com/macros/s/AKfycbynaU62bhKTWDJkLrl9cEoHaTHA6hM1DR84BA2rNpe-SAZBtgdouCcIi7DApNhr5uU5/exec";

const STUDENT_WEBAPP =
  "https://script.google.com/macros/s/AKfycbwJHRqvSstr-QcmA-VgcV2KChGUmCfyTTug8ImEzc5Yhc-fG6lYWuDTKghw1M2Fujwu1w/exec";

exports.handler = async (event) => {

  try {

    // GET -> Student list
    if (event.httpMethod === "GET") {

      const response = await fetch(
        STUDENT_WEBAPP + "?action=getStudents"
      );

      const text = await response.text();

      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json"
        },
        body: text
      };

    }

    // POST -> Camera attendance
    if (event.httpMethod === "POST") {

      const body = JSON.parse(event.body || "{}");

      const response = await fetch(CAMERA_WEBAPP, {
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

    }

    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        message: "Method Not Allowed"
      })
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
