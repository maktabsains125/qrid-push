/* shared/overlay/overlay.js */

(function () {

"use strict";

function createOverlay() {

  if (document.getElementById("overlayLoading")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="overlayLoading" class="overlayLoading">

      <div class="overlayBox">

        <div class="overlayRow">

          <div id="overlayText" class="overlayText">
            Loading
          </div>

          <div class="overlayDots">
            <span id="overlayDots"></span>
          </div>

        </div>

      </div>

    </div>
  `);

}

function ensureOverlay() {

  if (!document.getElementById("overlayLoading")) {
    createOverlay();
  }

}

function show(text = "Loading") {

  ensureOverlay();

  document.getElementById("overlayText").textContent = text;
  document.getElementById("overlayDots").style.display = "";

  document
    .getElementById("overlayLoading")
    .classList
    .add("active");

}

function hide() {

  const overlay = document.getElementById("overlayLoading");

  if (!overlay) return;

  overlay.classList.remove("active");

}

function message(text) {

  ensureOverlay();

  document.getElementById("overlayText").textContent = text;
  document.getElementById("overlayDots").style.display = "none";

  document
    .getElementById("overlayLoading")
    .classList
    .add("active");

}

window.Overlay = {

  show,

  hide,

  message,

  showLoading() {
    show("Loading");
  },

  showSaving() {
    show("Saving");
  },

  showVerifying() {
    show("Verifying");
  }

};

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    createOverlay,
    { once: true }
  );

} else {

  createOverlay();

}

})();
