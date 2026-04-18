// y7-regis/app.js
// Year 7 Registration Settings front-end

(function () {
  "use strict";

  // ===== Auth check =====
  const who = (window.Auth && typeof Auth.who === "function" && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // Teacher code that should match USERS!F2:F9
  const userCode = String(
    who.code ||
    who.username ||
    who.user ||
    who.email ||
    who.id ||
    ""
  ).trim();

  console.log("[Y7 settings] userCode:", userCode);

  // ===== API URL (your deployed Apps Script web app URL) =====
  const SETTINGS_WEBAPP_URL =
    "https://script.google.com/macros/s/AKfycbzMUk4h6iS0j8ubb-5658FRUsUyaUcsZ3n0OhValM_f9JMsOsv8946muL8zalpMo4c8/exec";

  // ===== DOM =====
  const editBtn          = document.getElementById("editBtn");
  const saveBtn          = document.getElementById("saveBtn");
  const noticeEl         = document.getElementById("settingsNotice");
  const formEl           = document.getElementById("settingsForm");
  const saveStatus       = document.getElementById("saveStatus");

  const editKeyInput     = document.getElementById("editKey");
  const toggleEditKeyBtn = document.getElementById("toggleEditKey");
  const editKeyGroup = document.getElementById("editKeyGroup");

  const responsesToggle  = document.getElementById("responsesToggle");
  const responsesCaption = document.getElementById("responsesCaption");

  const date1Input       = document.getElementById("date1");
  const date2Input       = document.getElementById("date2");

  const time1Input       = document.getElementById("time1");
  const time2Input       = document.getElementById("time2");
  const time3Input       = document.getElementById("time3");
  const time4Input       = document.getElementById("time4");

  const opt1Input        = document.getElementById("opt1");
  const opt2Input        = document.getElementById("opt2");
  const opt3Input        = document.getElementById("opt3");
  const opt4Input        = document.getElementById("opt4");

  const allCtlInputs = Array.from(
    document.querySelectorAll("#settingsForm .ctl")
  );

  let canEdit          = false;
  let isEditing        = false;
  let responsesEnabled = false;

  // ===== Helpers =====

  function setToggle(on) {
    if (!responsesToggle || !responsesCaption) return;

    responsesEnabled = !!on;
    responsesToggle.classList.toggle("toggle--on", on);
    responsesToggle.classList.toggle("toggle--off", !on);
    responsesToggle.setAttribute("aria-pressed", on ? "true" : "false");
    responsesCaption.textContent = on ? "ON" : "OFF";
  }

  function setEditable(on) {
    const editable = !!on;

    // Inputs
    allCtlInputs.forEach((el) => {
      el.disabled = !editable;
    });

    // Toggle
    if (responsesToggle) {
      responsesToggle.classList.toggle("toggle--disabled", !editable);
      responsesToggle.setAttribute("aria-disabled", editable ? "false" : "true");
    }

    if (saveBtn) {
      saveBtn.disabled = !editable;
    }
  }

  function showStatus(msg) {
    if (!saveStatus) return;
    saveStatus.textContent = msg || "";
  }

  function clearStatus() {
    showStatus("");
  }

  // ===== DATE/TIME FORMAT HELPERS =====

  // "YYYY-MM-DD" -> "24TH NOV 2025"
  function formatIsoDateForSheet(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";

    const day = d.getDate();
    const year = d.getFullYear();
    const monthIdx = d.getMonth(); // 0-11

    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

    let suffix = "TH";
    if (day % 10 === 1 && day !== 11) suffix = "ST";
    else if (day % 10 === 2 && day !== 12) suffix = "ND";
    else if (day % 10 === 3 && day !== 13) suffix = "RD";

    return `${day}${suffix} ${months[monthIdx]} ${year}`;
  }

  // "24TH NOV 2025 & 25TH NOV 2025" (or "24TH NOV & 25TH NOV 2025") -> { d1:"YYYY-MM-DD", d2:"YYYY-MM-DD" }
  function parseSheetDatesToIso(regisDate) {
    const out = { d1: "", d2: "" };
    if (!regisDate) return out;

    const parts = regisDate.split("&");
    const trimmedParts = parts.map(p => (p || "").trim().toUpperCase());

    const yearMatch = regisDate.match(/(\d{4})/);
    const defaultYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    const monthMap = {
      JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5,
      JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11
    };

    function parseOne(str) {
      if (!str) return "";
      const m = str.match(/(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Z]{3})(?:\s+(\d{4}))?/);
      if (!m) return "";
      const day = parseInt(m[1], 10);
      const monAbbr = m[2];
      const year = m[3] ? parseInt(m[3], 10) : defaultYear;
      const monthIdx = monthMap[monAbbr];
      if (isNaN(day) || monthIdx == null || isNaN(year)) return "";
      const d = new Date(year, monthIdx, day);
      if (isNaN(d.getTime())) return "";
      const yyyy = d.getFullYear();
      const mm   = String(d.getMonth() + 1).padStart(2, "0");
      const dd   = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    out.d1 = parseOne(trimmedParts[0] || "");
    if (trimmedParts[1]) {
      out.d2 = parseOne(trimmedParts[1] || "");
    }
    return out;
  }

  // "HH:MM" -> "8AM" / "12:30PM"
  function formatIsoTimeForSheet(isoTime) {
    if (!isoTime) return "";
    const parts = isoTime.split(":");
    if (parts.length < 2) return "";

    let h = parseInt(parts[0], 10);
    const m = parts[1];

    if (isNaN(h)) return "";

    const isPM = h >= 12;
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;

    if (m === "00") {
      return `${h12}${isPM ? "PM" : "AM"}`;
    }
    return `${h12}:${m}${isPM ? "PM" : "AM"}`;
  }

  // "8AM TO 12:30PM ; 2PM TO 4PM" -> { t1:"HH:MM", t2:"HH:MM", t3:"HH:MM", t4:"HH:MM" }
  function parseSheetTimesToIso(regisTime) {
    const out = { t1: "", t2: "", t3: "", t4: "" };
    if (!regisTime) return out;

    const sections = regisTime.split(";");

    function parseTimeStr(str) {
      if (!str) return "";
      const cleaned = str.trim().toUpperCase();
      const m = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
      if (!m) return "";
      let h = parseInt(m[1], 10);
      const mm = m[2] ? parseInt(m[2], 10) : 0;
      const ampm = m[3];

      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;

      const hhStr = String(h).padStart(2, "0");
      const mmStr = String(mm).padStart(2, "0");
      return `${hhStr}:${mmStr}`;
    }

    function parseSection(sec) {
      if (!sec) return ["", ""];
      const parts = sec.split("TO");
      const left  = parseTimeStr(parts[0] || "");
      const right = parseTimeStr(parts[1] || "");
      return [left, right];
    }

    const s1 = parseSection(sections[0] || "");
    out.t1 = s1[0];
    out.t2 = s1[1];

    if (sections[1]) {
      const s2 = parseSection(sections[1] || "");
      out.t3 = s2[0];
      out.t4 = s2[1];
    }

    return out;
  }

  // ===== Apply settings to UI =====
  function applySettingsToUI(settings) {
    const s = settings || {};

    // Edit key (stored normally, shown as password dots)
    if (editKeyInput) {
      editKeyInput.value = (s.editKey || "").toUpperCase();
    }

    // responses
    const respOn = String(s.responses || "0") === "1";
    setToggle(respOn);

    // Dates -> date pickers
    const dateIso = parseSheetDatesToIso(String(s.regisDate || ""));
    if (date1Input) date1Input.value = dateIso.d1 || "";
    if (date2Input) date2Input.value = dateIso.d2 || "";

    // Times -> time pickers
    const timeIso = parseSheetTimesToIso(String(s.regisTime || ""));
    if (time1Input) time1Input.value = timeIso.t1 || "";
    if (time2Input) time2Input.value = timeIso.t2 || "";
    if (time3Input) time3Input.value = timeIso.t3 || "";
    if (time4Input) time4Input.value = timeIso.t4 || "";

    // Options
    if (opt1Input) opt1Input.value = String(s.opt1 || "").toUpperCase();
    if (opt2Input) opt2Input.value = String(s.opt2 || "").toUpperCase();
    if (opt3Input) opt3Input.value = String(s.opt3 || "").toUpperCase();
    if (opt4Input) opt4Input.value = String(s.opt4 || "").toUpperCase();
  }

  function collectSettingsFromUI() {
    const editKey = editKeyInput ? editKeyInput.value.trim().toUpperCase() : "";

    const d1 = date1Input ? date1Input.value.trim() : ""; // YYYY-MM-DD
    const d2 = date2Input ? date2Input.value.trim() : "";

    const t1 = time1Input ? time1Input.value.trim() : ""; // HH:MM
    const t2 = time2Input ? time2Input.value.trim() : "";
    const t3 = time3Input ? time3Input.value.trim() : "";
    const t4 = time4Input ? time4Input.value.trim() : "";

    const opt1 = opt1Input ? opt1Input.value.trim().toUpperCase() : "";
    const opt2 = opt2Input ? opt2Input.value.trim().toUpperCase() : "";
    const opt3 = opt3Input ? opt3Input.value.trim().toUpperCase() : "";
    const opt4 = opt4Input ? opt4Input.value.trim().toUpperCase() : "";

    // Build registration date string (D1 & D2)
    const dateParts = [];
    if (d1) dateParts.push(formatIsoDateForSheet(d1));
    if (d2) dateParts.push(formatIsoDateForSheet(d2));
    const regisDate = dateParts.filter(Boolean).join(" & ");

    // Build registration time string: "x TO y ; a TO b"
    const timeChunks = [];
    if (t1 || t2) {
      const s1 = formatIsoTimeForSheet(t1);
      const s2 = formatIsoTimeForSheet(t2);
      if (s1 || s2) {
        timeChunks.push((s1 || "") + " TO " + (s2 || ""));
      }
    }
    if (t3 || t4) {
      const s3 = formatIsoTimeForSheet(t3);
      const s4 = formatIsoTimeForSheet(t4);
      if (s3 || s4) {
        timeChunks.push((s3 || "") + " TO " + (s4 || ""));
      }
    }
    const regisTime = timeChunks.filter(Boolean).join(" ; ");

    const responses = responsesEnabled ? 1 : 0;

    return {
      editKey: editKey,
      regisDate: regisDate,
      regisTime: regisTime,
      responses: responses,
      opt1: opt1,
      opt2: opt2,
      opt3: opt3,
      opt4: opt4
    };
  }

  // ===== LOAD ON START =====
async function loadSettings() {
  clearStatus();
  showStatus("Loading settings…");

  try {
    const url =
      SETTINGS_WEBAPP_URL +
      "?mode=getSettings&code=" +
      encodeURIComponent(userCode || "");

    const res = await fetch(url, {
      method: "GET",
      mode: "cors"
    });

    if (!res.ok) {
      throw new Error("Network error (" + res.status + ")");
    }

    const data = await res.json();
    console.log("[Y7 settings] getSettings response:", data);

    if (!data.ok) throw new Error(data.error || "Server error");

    // who can edit settings
    canEdit = !!data.canEdit;

    // apply settings to UI
    applySettingsToUI(data.settings || {});

    // NEW: show/hide the Edit Key group based on backend flag
    if (typeof editKeyGroup !== "undefined" && editKeyGroup) {
      const canViewKey = !!data.canViewKey; // expect backend to send this
      editKeyGroup.hidden = !canViewKey;
    }

    // default: view-only state
    isEditing = false;
    setEditable(false);

    if (!canEdit) {
      if (noticeEl) noticeEl.hidden = false;
      if (editBtn) editBtn.disabled = true;
      if (saveBtn) saveBtn.disabled = true;
    } else {
      if (noticeEl) noticeEl.hidden = true;
      if (editBtn) editBtn.disabled = false;
    }

    showStatus("Loaded.");
    setTimeout(clearStatus, 1500);
  } catch (err) {
    console.error("[Y7 settings] load error:", err);
    showStatus("Error loading settings: " + err.message);
  }
}


  // ===== EVENTS =====

  // Toggle responses
  if (responsesToggle) {
    responsesToggle.addEventListener("click", function () {
      if (!isEditing) return; // ignore if not in edit mode
      if (responsesToggle.classList.contains("toggle--disabled")) return;
      setToggle(!responsesEnabled);
    });
  }

  // Edit button
  if (editBtn) {
    editBtn.addEventListener("click", function () {
      if (!canEdit) return;
      isEditing = true;
      setEditable(true);
      clearStatus();
      showStatus("Edit mode. Remember to save.");
    });
  }

  // Save button
  if (saveBtn) {
    saveBtn.addEventListener("click", async function () {
      if (!canEdit || !isEditing) return;

      clearStatus();
      showStatus("Saving…");

      try {
        const settings = collectSettingsFromUI();

        const res = await fetch(SETTINGS_WEBAPP_URL, {
          method: "POST",
          mode: "cors",
          // IMPORTANT: no custom headers → no preflight
          body: JSON.stringify({
            mode: "saveSettings",
            code: userCode || "",
            settings: settings
          })
        });

        if (!res.ok) {
          throw new Error("Network error (" + res.status + ")");
        }

        const data = await res.json();
        console.log("[Y7 settings] saveSettings response:", data);

        if (!data.ok) throw new Error(data.error || "Server error");

        isEditing = false;
        setEditable(false);
        showStatus("Saved.");
        setTimeout(clearStatus, 1500);

        // Re-apply from what we just saved
        applySettingsToUI(settings);
      } catch (err) {
        console.error("[Y7 settings] save error:", err);
        showStatus("Error saving: " + err.message);
      }
    });
  }

  // Edit key eye button, purely visual, not real password
if (toggleEditKeyBtn && editKeyInput) {
  let visible = false;
  toggleEditKeyBtn.addEventListener("click", function () {
    visible = !visible;

    if (visible) {
      editKeyInput.classList.add("fakePassword--visible");
    } else {
      editKeyInput.classList.remove("fakePassword--visible");
    }

    toggleEditKeyBtn.classList.toggle("eyeBtn--on", visible);
    toggleEditKeyBtn.setAttribute(
      "aria-label",
      visible ? "Hide edit key" : "Show edit key"
    );
  });
}


  // Prevent submit
  if (formEl) {
    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      return false;
    });
  }

  // Initial load
  loadSettings();
})();
