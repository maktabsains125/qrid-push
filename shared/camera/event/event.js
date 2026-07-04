(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  const WEBAPP_URL =
    "https://script.google.com/macros/s/AKfycbzLcDCVIR5fao0tFDiBFD1F1jaeICDXqKqoCZ3a43zlYjb7mf149Lew1ybU8ry19misAA/exec";

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", () => {

    // ===== Navigation =====
    $("btnClose")?.addEventListener("click", () => {
      location.assign("/shared/camera/index.html");
    });

    // ===== Load Event =====
    loadEventInfo();

  });

  /******************************************************
   * LOADING
   ******************************************************/

  function showLoading(message = "Please wait") {
    $("statusText").textContent = message;
    $("statusDots").style.display = "";
  }

  function hideLoading(message = "Ready") {
    $("statusText").textContent = message;
    $("statusDots").style.display = "none";
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
        throw new Error(data.message || "Unable to load event information.");
      }

      $("eventName").value = data.eventName;
      $("tabName").textContent = data.tabName;
      $("eventDate").value = data.eventDate;
      $("attendeeCount").value = data.attendeeCount;

      // Enable attendance buttons
      [
        "btnCamera",
        "btnScanner",
        "btnManual",
        "btnAttendance",
        "btnEdit",
        "btnSave"
      ].forEach(id => {
        const el = $(id);
        if (el) el.disabled = false;
      });

      hideLoading("Ready");

    } catch (err) {

      console.error(err);

      hideLoading("Unable to load event information.");

    } finally {

      // Reveal page after first load
      document.documentElement.style.visibility = "visible";

    }

  }

})();
