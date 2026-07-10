const CAMERA_WEBAPP =
  "https://script.google.com/macros/s/AKfycbynaU62bhKTWDJkLrl9cEoHaTHA6hM1DR84BA2rNpe-SAZBtgdouCcIi7DApNhr5uU5/exec";

const STUDENT_WEBAPP =
  "https://script.google.com/macros/s/AKfycbwJHRqvSstr-QcmA-VgcV2KChGUmCfyTTug8ImEzc5Yhc-fG6lYWuDTKghw1M2Fujwu1w/exec";

exports.handler = async (event) => {

  try {

    /******************************************************
     * GET -> Student list
     ******************************************************/
    if (event.httpMethod === "GET") {

      try {

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

      } catch (err) {

        return {
          statusCode: 500,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            success: false,
            where: "GET STUDENT_WEBAPP",
            message: err.message,
            stack: err.stack
          })
        };

      }

    }


    /******************************************************
     * POST -> Attendance
     ******************************************************/
    if (event.httpMethod === "POST") {

      const body = JSON.parse(event.body || "{}");

      try {

        const response = await fetch(
          CAMERA_WEBAPP,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }
        );

        const text = await response.text();

        return {
          statusCode: response.status,
          headers: {
            "Content-Type": "application/json"
          },
          body: text
        };

      } catch (err) {

        return {
          statusCode: 500,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            success: false,
            where: "POST CAMERA_WEBAPP",
            message: err.message,
            stack: err.stack
          })
        };

      }

    }


    /******************************************************
     * Invalid method
     ******************************************************/
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: false,
        message: "Method Not Allowed"
      })
    };

  } catch (err) {

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: false,
        where: "Top Level",
        message: err.message,
        stack: err.stack
      })
    };

  }

};
