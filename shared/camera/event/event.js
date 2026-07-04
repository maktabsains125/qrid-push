const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzLcDCVIR5fao0tFDiBFD1F1jaeICDXqKqoCZ3a43zlYjb7mf149Lew1ybU8ry19misAA/exec";

document.addEventListener("DOMContentLoaded", loadEventInfo);

async function loadEventInfo() {

  try {

    const response = await fetch(`${WEBAPP_URL}?action=getEventInfo`);

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Unable to load event information.");
    }

    document.getElementById("eventName").value = data.eventName;
    document.getElementById("tabName").textContent = data.tabName;
    document.getElementById("eventDate").value = data.eventDate;
    document.getElementById("attendeeCount").value = data.attendeeCount;

    document.getElementById("statusText").textContent = "Ready";
    document.documentElement.style.visibility = "visible";

  } catch (err) {

    console.error(err);

    document.getElementById("statusText").textContent = "Unable to load event information.";
    document.documentElement.style.visibility = "visible";

  }

}