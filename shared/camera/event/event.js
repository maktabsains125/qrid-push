(function () {
  "use strict";

  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzLcDCVIR5fao0tFDiBFD1F1jaeICDXqKqoCZ3a43zlYjb7mf149Lew1ybU8ry19misAA/exec";

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", () => {

    // ===== Buttons =====
    $("btnClose")?.addEventListener("click", () => {
      location.assign("/shared/camera/index.html");
    });

    // ===== Load page =====
    loadEventInfo();

  });

  async function loadEventInfo() {

    try {

      $("statusText").textContent = "Loading event information...";

      const response = await fetch(
        `${WEBAPP_URL}?action=getEventInfo`
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to load event information.");
      }

      $("eventName").value = data.eventName;
      $("tabName").textContent = data.tabName;
      $("eventDate").value = data.eventDate;
      $("attendeeCount").value = data.attendeeCount;

      $("statusText").textContent = "Ready";

    } catch (err) {

      console.error(err);

      $("statusText").textContent = "Unable to load event information.";

    } finally {

      // Reveal page after loading (success or failure)
      document.documentElement.style.visibility = "visible";

    }

  }

})();
