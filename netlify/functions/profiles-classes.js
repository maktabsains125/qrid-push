const fetch = require("node-fetch");

const GAS_URL =
"https://script.google.com/macros/s/AKfycbybBTtZEb4BuWp2GqBGWuw2n85bVkmym3B9IutuCqtycw0t_JE0AabLPQ-EcRQYb3Eq/exec";

exports.handler = async (event) => {

    try {

        const level = event.queryStringParameters.level;

        const params = new URLSearchParams({
            fn: "profiles.classes",
            level
        });

        const res = await fetch(
            `${GAS_URL}?${params.toString()}`
        );

        if (!res.ok) {
            return {
                statusCode: res.status,
                body: JSON.stringify({
                    ok: false,
                    error: "Apps Script error"
                })
            };
        }

        const data = await res.json();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        };

    } catch (err) {

        return {
            statusCode: 500,
            body: JSON.stringify({
                ok: false,
                error: err.message
            })
        };

    }

};
