(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  const WEBAPP_URL =
    "https://script.google.com/macros/s/AKfycbzLcDCVIR5fao0tFDiBFD1F1jaeICDXqKqoCZ3a43zlYjb7mf149Lew1ybU8ry19misAA/exec";

  const SAVE_URL = "/.netlify/functions/event-save";

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", () => {

    // ===== Navigation =====
    $("btnClose")?.addEventListener("click", () => {
      location.assign("/shared/camera/index.html");
    });

    $("btnAttendance")?.addEventListener("click", () => {
      window.open(
        "https://docs.google.com/spreadsheets/d/1XQxwrYfPF-G8Ajh4WTVrG4jOymIELrbfbC7MuN93Ykc/edit?usp=sharing",
        "_blank"
      );
    });

    $("btnEdit")?.addEventListener("click", () => {
      window.open(
        "https://docs.google.com/spreadsheets/d/1B1zH-uB6OJsdl1moO-DysWi_wV8JwQh9wzGwOH4dQRw/edit?usp=sharing",
        "_blank"
      );
    });

    $("btnSave")?.addEventListener("click", saveEvent);

    // ===== Initial Load =====
    loadEventInfo();

  });

  /******************************************************
   * LOADING
   ******************************************************/

  function showLoading(message = "Please wait") {

    $("statusRow").style.display = "flex";
    $("statusText").textContent = message;
    $("statusDots").style.display = "";

  }

  function hideLoading(message = "Ready") {

    $("statusText").textContent = message;
    $("statusDots").style.display = "none";
    $("statusRow").style.display = "none";

  }

  /******************************************************
   * LOAD EVENT INFORMATION
   ******************************************************/

  async function loadEventInfo() {

    showLoading("Loading event information...");

    try {

      const response = await fetch(
        `${WEBAPP_URL}?action=getEventInfo`
      );

      if (!response.ok) {
        throw new Error("Unable to connect to server.");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message || "Unable to load event information."
        );
      }

      $("eventName").value = data.eventName;
      $("tabName").textContent = data.tabName;
      $("eventDate").value = data.eventDate;
      $("attendeeCount").value = data.attendeeCount;

      [
        "btnCamera",
        "btnScanner",
        "btnManual",
        "btnAttendance",
        "btnEdit",
        "btnSave"
      ].forEach(id => {

        const el = $(id);

        if (el) {
          el.disabled = false;
        }

      });

      hideLoading("Ready");

    }

    catch (err) {

      console.error(err);

      hideLoading("Unable to load event information.");

    }

    finally {

      document.documentElement.style.visibility = "visible";

    }

  }

   /******************************************************
   * POST JSON
   ******************************************************/
  async function postJSON(url, body) {

    const response = await fetch(url, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(body)

    });

    const data = await response.json();

    if (!response.ok || data.success === false) {

      throw new Error(
        data.message || "Unable to contact server."
      );

    }

    return data;

  }


  /******************************************************
   * SAVE EVENT
   ******************************************************/
  async function saveEvent() {

    showLoading("Saving event...");

    try {

      const data = await postJSON(

        SAVE_URL,

        {

          action: "saveEvent",

          user: who.code

        }

      );

      // Reload event information after saving
      await loadEventInfo();

      hideLoading("Ready");

      alert(data.message || "Event saved successfully.");

    }

    catch (err) {

      console.error(err);

      hideLoading("Save failed");

      alert(err.message);

    }

  }

})();
