/* Profiles app — role-aware buttons + level view + GAS fetch
   + dropdown classes + loading status + modal per student */

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return;
  }

  // ===== ROLE ALLOW-LIST =====
  const role = String(who.role || "").toUpperCase().trim();
  const ALLOWED_ROLES = ["FT", "REGIS", "ADMIN", "HEP", "WELFARE", "CODER"];

  if (!ALLOWED_ROLES.includes(role)) {
    let dest = "/roles/general";
    if (window.Auth && typeof Auth.routeFor === "function") {
      dest = Auth.routeFor(role || "GENERAL") || "/roles/general";
    }
    window.location.replace(dest);
    return;
  }

  // ===== CONFIG =====
  const GAS_URL = "https://script.google.com/macros/s/AKfycbyheg1vZR_GmdanPj07Vr9qrsJv3bUcxHEBgEPPQiyhfzd3Vd3azeoiABPEAK6Sf77d/exec";

  // ===== Year in header =====
  const yy = document.getElementById("yy");
  if (yy) yy.textContent = new Date().getFullYear();

  // ===== Views + buttons =====
  const homeView  = document.getElementById("homeView");
  const levelView = document.getElementById("levelView");
  const closeBtn  = document.getElementById("closeBtn");

  // ===== Loading status area =====
  const loadStatus = document.getElementById("loadStatus");
  const loadMsg    = document.getElementById("loadMsg");
  const dotsEl     = document.getElementById("dots");

  let dotsTimer = null;

  function startDots() {
    stopDots();
    if (!dotsEl) return;
    const frames = ["...", ".. ", ".  ", "   "];
    let i = 0;
    dotsEl.textContent = frames[0];
    dotsTimer = setInterval(() => {
      i = (i + 1) % frames.length;
      dotsEl.textContent = frames[i];
    }, 500);
  }

  function stopDots() {
    if (dotsTimer) {
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
  }

  function showStatus(message) {
    if (!loadStatus) return;
    loadStatus.hidden = false;
    if (loadMsg) loadMsg.textContent = message;
    startDots();
  }

  function hideStatus() {
    stopDots();
    if (!loadStatus) return;
    loadStatus.hidden = true;
  }

  // ===== Sections =====
  function showHome() {
    if (homeView) homeView.hidden = false;
    if (levelView) levelView.hidden = true;

    document.body.classList.remove("mode-level");
    document.documentElement.classList.remove("mode-level");

    hideStatus();
  }

  function showLevel() {
    if (homeView) homeView.hidden = true;
    if (levelView) levelView.hidden = false;

    document.body.classList.add("mode-level");
    document.documentElement.classList.add("mode-level");
  }

  showHome();

  // ===== Close button behaviour =====
  function gotoRoleDashboard() {
    const roleFromAuth = (window.Auth && typeof Auth.who === "function" && Auth.who()?.role) || "";
    const roleFromLS   = (localStorage.getItem("ms_role") || "");
    const role = String(roleFromAuth || roleFromLS).toUpperCase().trim();

    const dest =
      (window.Auth && typeof Auth.routeFor === "function" && role)
        ? (Auth.routeFor(role) || "/")
        : (role ? `/roles/${role.toLowerCase()}` : "/");

    location.replace(dest);
  }

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (document.body.classList.contains("mode-level")) {
      showHome();
    } else {
      gotoRoleDashboard();
    }
  });

  // ===== Tabs =====
  const tabSearch  = document.getElementById("tabSearch");
  const tabClass   = document.getElementById("tabClass");
  const paneSearch = document.getElementById("searchPane");
  const paneClass  = document.getElementById("classPane");

  function setTab(which) {
    const isSearch = (which === "search");
    tabSearch?.classList.toggle("tab--active", isSearch);
    tabClass?.classList.toggle("tab--active", !isSearch);
    if (paneSearch) paneSearch.hidden = !isSearch;
    if (paneClass) paneClass.hidden = isSearch;
  }

  tabSearch?.addEventListener("click", () => setTab("search"));
  tabClass?.addEventListener("click", () => setTab("class"));

  // ===== Role / FT info =====
  const ft = window.Auth?.ft?.() || {};
  const ftLevel = (ft.level || localStorage.getItem("ms_level") || "").trim();
  const ftClass = (ft.class || localStorage.getItem("ms_class") || "").trim();

  const levelBtns  = Array.from(document.querySelectorAll(".levelBtn"));
  const allBtn     = document.getElementById("allBtn");
  const welfareBtn = document.getElementById("welfareBtn");
  const y7RegBtn   = document.getElementById("y7RegBtn");

  function blockLink(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function disable(el, yes = true) {
    if (!el) return;
    el.setAttribute("aria-disabled", String(yes));
    el.classList.toggle("disabled", yes);
    if (el.tagName === "BUTTON") el.disabled = yes;
    if (el.tagName === "A") {
      el.tabIndex = yes ? -1 : 0;
      if (yes) el.addEventListener("click", blockLink, { once: true });
    }
  }

  // ===== Gate access per role =====
  switch (role) {
    case "FT": {
      const target = ftLevel;
      levelBtns.forEach((b) => {
        if (b.dataset.level !== String(target)) disable(b, true);
      });
      disable(allBtn, true);
      disable(welfareBtn, true);
      disable(y7RegBtn, true);
      break;
    }

    case "REGIS":
    case "ADMIN":
    case "CODER":
      break;

    case "HEP":
      disable(allBtn, true);
      disable(welfareBtn, true);
      disable(y7RegBtn, true);
      break;

    case "WELFARE":
      levelBtns.forEach((b) => disable(b, true));
      disable(allBtn, true);
      disable(y7RegBtn, true);
      break;

    default:
      levelBtns.forEach((b) => disable(b, true));
      disable(allBtn, true);
      disable(welfareBtn, true);
      disable(y7RegBtn, true);
      break;
  }

  // ===== Form / table DOM =====
  const classInput  = document.getElementById("classInput");
  const classInput2 = document.getElementById("classInput2");

  const nameInput = document.getElementById("nameInput");
  const nameList  = document.getElementById("nameList");

  const tbody = document.getElementById("classTbody");

  // ===== Detail fields in Search tab =====
  const F = (id) => document.getElementById(id);

  const fields = {
    adm: F("adm"),
    gender: F("gender"),

    bday: F("bday"),
    bmonth: F("bmonth"),
    byear: F("byear"),

    ic: F("ic"),
    bruhims: F("bru-hims"),

    med: F("med"),
    aid: F("aid"),
    welfare: F("welfare"),
    house: F("house"),

    father: F("father"),
    fatherPhone: F("fatherPhone"),
    fatherAdd: F("fatherAdd"),
    fatherOcc: F("fatherOcc"),

    mother: F("mother"),
    motherPhone: F("motherPhone"),
    motherAdd: F("motherAdd"),
    motherOcc: F("motherOcc"),

    guardian: F("guardian"),
    guardianRel: F("guardianRel"),
    guardianPhone: F("guardianPhone"),
    guardianAdd: F("guardianAdd"),
    guardianOcc: F("guardianOcc")
  };

  // ===== Modal DOM =====
  const modalDim   = document.getElementById("modalDim");
  const modalClose = document.getElementById("modalClose");
  const modalBody  = document.getElementById("modalBody");

  // ===== State =====
  let currentLevel  = "";
  let cachedRows    = [];
  let lastClassRows = [];

  // ===== Backend helpers =====
  async function fetchProfiles(level, clazz) {
    const params = new URLSearchParams({ fn: "profiles.get", level, clazz });
    const res = await fetch(`${GAS_URL}?${params.toString()}`, { mode: "cors" });
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();
    if (!data?.ok) throw new Error(data?.error || "Server error");
    return data;
  }

  async function fetchClasses(level) {
    const params = new URLSearchParams({ fn: "profiles.classes", level });
    const res = await fetch(`${GAS_URL}?${params.toString()}`, { mode: "cors" });
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();
    if (!data?.ok) throw new Error(data?.error || "Server error");
    return data;
  }

  // ===== Helpers =====
  function fullDOB(row) {
    const d = [
      row["BIRTH DAY"],
      row["BIRTH MONTH"],
      row["BIRTH YEAR"]
    ].filter(Boolean).join("-");
    return d || "";
  }

  function fillRow(r) {
    fields.adm.value            = r["ADM NO."] || "";
    fields.gender.value         = r["GENDER"] || "";
    fields.bday.value           = r["BIRTH DAY"] || "";
    fields.bmonth.value         = r["BIRTH MONTH"] || "";
    fields.byear.value          = r["BIRTH YEAR"] || "";

    fields.ic.value             = r["IC"] || "";
    fields.bruhims.value        = r["BRU-HIMS"] || "";

    fields.med.value            = r["MEDICAL CONDITION"] || "";
    fields.aid.value            = r["AID"] || "";
    fields.welfare.value        = r["WELFARE"] || "";
    fields.house.value          = r["SPORTSHOUSE"] || "";

    fields.father.value         = r["FATHER'S NAME"] || "";
    fields.fatherPhone.value    = r["FATHER PHONE"] || "";
    fields.fatherOcc.value      = r["FATHER OCCUPATION"] || "";
    fields.fatherAdd.value      = r["FATHER ADDRESS"] || "";

    fields.mother.value         = r["MOTHER'S NAME"] || "";
    fields.motherPhone.value    = r["MOTHER PHONE"] || "";
    fields.motherOcc.value      = r["MOTHER OCCUPATION"] || "";
    fields.motherAdd.value      = r["MOTHER ADDRESS"] || "";

    fields.guardian.value       = r["GUARDIAN"] || "";
    fields.guardianRel.value    = r["GUARDIAN RELATION"] || "";
    fields.guardianPhone.value  = r["GUARDIAN PHONE"] || "";
    fields.guardianOcc.value    = r["GUARDIAN OCCUPATION"] || "";
    fields.guardianAdd.value    = r["GUARDIAN ADDRESS"] || "";
  }

  function hideNameList() {
    if (!nameList) return;
    nameList.hidden = true;
    nameList.innerHTML = "";
  }

  function renderNameList(query) {
    const q = (query || "").trim().toLowerCase();
    const pool = cachedRows.filter((r) => {
      if (!q) return true;
      return String(r["STUDENT'S NAME"] || "").toLowerCase().includes(q);
    });

    if (!pool.length) {
      hideNameList();
      return;
    }

    if (!nameList) return;

    nameList.innerHTML = pool.slice(0, 200).map((r) => {
      const nm = r["STUDENT'S NAME"] || "";
      return `<button type="button" data-adm="${r["ADM NO."] || ""}">${nm}</button>`;
    }).join("");

    nameList.hidden = false;

    Array.from(nameList.querySelectorAll("button")).forEach((b) => {
      b.addEventListener("click", () => {
        const adm = b.getAttribute("data-adm") || "";
        const row = cachedRows.find((x) => String(x["ADM NO."] || "") === adm);
        if (row) fillRow(row);
        if (nameInput) nameInput.value = b.textContent || "";
        hideNameList();
      });
    });
  }

  function populateClassDropdowns(classes, lockedClass) {
    function fillSelect(sel) {
      if (!sel) return;

      sel.innerHTML = "";

      if (!lockedClass) {
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "— Select —";
        sel.appendChild(opt0);
      }

      classes.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });

      if (lockedClass) {
        sel.value = lockedClass;
        sel.disabled = true;
      } else {
        sel.disabled = false;
        sel.value = "";
      }
    }

    fillSelect(classInput);
    fillSelect(classInput2);
  }

  // ===== MODAL =====
  function openStudentModal(studentObj) {
    if (!modalDim || !modalBody) return;

    const htmlParts = [];

    htmlParts.push(
      `<div class="modalLabel">ID</div><div class="modalValue">${studentObj["ADM NO."] || ""}</div>`,
      `<div class="modalLabel">Name</div><div class="modalValue">${studentObj["STUDENT'S NAME"] || ""}</div>`,
      `<div class="modalLabel">Gender</div><div class="modalValue">${studentObj["GENDER"] || ""}</div>`,
      `<div class="modalLabel">DOB</div><div class="modalValue">${fullDOB(studentObj) || ""}</div>`,
      `<div class="modalLabel">IC</div><div class="modalValue">${studentObj["IC"] || ""}</div>`,
      `<div class="modalLabel">BRU-HIMS</div><div class="modalValue">${studentObj["BRU-HIMS"] || ""}</div>`,
      `<div class="modalLabel">Medical</div><div class="modalValue">${studentObj["MEDICAL CONDITION"] || ""}</div>`,
      `<div class="modalLabel">Aid</div><div class="modalValue">${studentObj["AID"] || ""}</div>`,
      `<div class="modalLabel">Welfare</div><div class="modalValue">${studentObj["WELFARE"] || ""}</div>`,
      `<div class="modalLabel">House</div><div class="modalValue">${studentObj["SPORTSHOUSE"] || ""}</div>`
    );

    htmlParts.push(
      `<div class="modalGroupHead" style="color:#1b3487;">Father</div>`,
      `<div class="modalLabel">Name</div><div class="modalValue">${studentObj["FATHER'S NAME"] || ""}</div>`,
      `<div class="modalLabel">Phone</div><div class="modalValue">${studentObj["FATHER PHONE"] || ""}</div>`,
      `<div class="modalLabel">Job</div><div class="modalValue">${studentObj["FATHER OCCUPATION"] || ""}</div>`,
      `<div class="modalLabel">Address</div><div class="modalValue">${studentObj["FATHER ADDRESS"] || ""}</div>`
    );

    htmlParts.push(
      `<div class="modalGroupHead" style="color:#ab1f57;">Mother</div>`,
      `<div class="modalLabel">Name</div><div class="modalValue">${studentObj["MOTHER'S NAME"] || ""}</div>`,
      `<div class="modalLabel">Phone</div><div class="modalValue">${studentObj["MOTHER PHONE"] || ""}</div>`,
      `<div class="modalLabel">Job</div><div class="modalValue">${studentObj["MOTHER OCCUPATION"] || ""}</div>`,
      `<div class="modalLabel">Address</div><div class="modalValue">${studentObj["MOTHER ADDRESS"] || ""}</div>`
    );

    htmlParts.push(
      `<div class="modalGroupHead" style="color:#297a1f;">Guardian</div>`,
      `<div class="modalLabel">Name</div><div class="modalValue">${studentObj["GUARDIAN"] || ""}</div>`,
      `<div class="modalLabel">Relation</div><div class="modalValue">${studentObj["GUARDIAN RELATION"] || ""}</div>`,
      `<div class="modalLabel">Phone</div><div class="modalValue">${studentObj["GUARDIAN PHONE"] || ""}</div>`,
      `<div class="modalLabel">Occupation</div><div class="modalValue">${studentObj["GUARDIAN OCCUPATION"] || ""}</div>`,
      `<div class="modalLabel">Address</div><div class="modalValue">${studentObj["GUARDIAN ADDRESS"] || ""}</div>`
    );

    modalBody.innerHTML = htmlParts.join("");
    modalDim.hidden = false;
  }

  function closeStudentModal() {
    if (!modalDim) return;
    modalDim.hidden = true;
  }

  modalClose?.addEventListener("click", closeStudentModal);
  modalDim?.addEventListener("click", (e) => {
    if (e.target === modalDim) closeStudentModal();
  });

  // ===== TABLE =====
  function activateTableRowClicks() {
    if (!tbody) return;
    const trs = Array.from(tbody.querySelectorAll("tr"));

    trs.forEach((tr) => {
      tr.addEventListener("click", () => {
        trs.forEach((x) => x.classList.remove("row-active"));
        tr.classList.add("row-active");

        const admCell = tr.querySelector("td");
        const admVal = admCell ? admCell.textContent.trim() : "";

        const stu = lastClassRows.find(
          (r) => String(r["ADM NO."] || "").trim() === admVal
        );

        if (stu) {
          openStudentModal(stu);
        } else {
          openStudentModal({
            "ADM NO.": admVal,
            "STUDENT'S NAME": tr.textContent.trim()
          });
        }
      });
    });
  }

  function renderClassTable(rows) {
    if (!tbody) return;

    tbody.innerHTML =
      rows.map((r) => `
        <tr>
          <td>${r["ADM NO."] || ""}</td>
          <td>${r["STUDENT'S NAME"] || ""}</td>
          <td>${r["GENDER"] || ""}</td>
          <td>${fullDOB(r) || ""}</td>
          <td>${r["IC"] || ""}</td>
          <td>${r["BRU-HIMS"] || ""}</td>
          <td>${r["MEDICAL CONDITION"] || ""}</td>
          <td>${r["AID"] || ""}</td>
          <td>${r["WELFARE"] || ""}</td>
          <td>${r["SPORTSHOUSE"] || ""}</td>
          <td>${r["FATHER'S NAME"] || ""}</td>
          <td>${r["FATHER PHONE"] || ""}</td>
          <td>${r["FATHER ADDRESS"] || ""}</td>
          <td>${r["FATHER OCCUPATION"] || ""}</td>
          <td>${r["MOTHER'S NAME"] || ""}</td>
          <td>${r["MOTHER PHONE"] || ""}</td>
          <td>${r["MOTHER ADDRESS"] || ""}</td>
          <td>${r["MOTHER OCCUPATION"] || ""}</td>
          <td>${r["GUARDIAN"] || ""}</td>
          <td>${r["GUARDIAN RELATION"] || ""}</td>
          <td>${r["GUARDIAN PHONE"] || ""}</td>
          <td>${r["GUARDIAN ADDRESS"] || ""}</td>
          <td>${r["GUARDIAN OCCUPATION"] || ""}</td>
        </tr>
      `).join("") || `<tr><td colspan="23">No data.</td></tr>`;

    activateTableRowClicks();
  }

  // ===== Shared loader (single fetch only) =====
  async function loadProfilesData() {
    const clazz = (role === "FT")
      ? ftClass
      : ((classInput2 && classInput2.value) || (classInput && classInput.value) || "").trim().toUpperCase();

    if (!currentLevel || !clazz) {
      cachedRows = [];
      lastClassRows = [];
      hideNameList();

      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="23">Please choose class.</td></tr>`;
      }
      activateTableRowClicks();
      return;
    }

    showStatus("Names loading. Please wait");
    try {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="23">Loading…</td></tr>`;
      }

      const data = await fetchProfiles(currentLevel, clazz);
      const rows = data.rows || [];

      cachedRows = rows.slice();
      lastClassRows = rows.slice();

      renderNameList(nameInput?.value || "");
      renderClassTable(rows);

    } catch (err) {
      cachedRows = [];
      lastClassRows = [];
      hideNameList();

      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="23">Error: ${String(err.message || err)}</td></tr>`;
      }
      activateTableRowClicks();
    } finally {
      hideStatus();
    }
  }

  // ===== CLASS CHANGE HANDLER =====
  function onClassChange() {
    cachedRows = [];
    hideNameList();

    if (classInput && classInput2) {
      if (this === classInput && !classInput2.disabled) {
        classInput2.value = classInput.value;
      }
      if (this === classInput2 && !classInput.disabled) {
        classInput.value = classInput2.value;
      }
    }

    loadProfilesData();
  }

  classInput?.addEventListener("change", onClassChange);
  classInput2?.addEventListener("change", onClassChange);

  // ===== NAME TYPING =====
  nameInput?.addEventListener("input", (e) => {
    renderNameList(e.target.value);
  });

  document.addEventListener("click", (e) => {
    if (nameList && !nameList.contains(e.target) && e.target !== nameInput) {
      hideNameList();
    }
  });

  // ===== MANUAL RELOAD BUTTON =====
  document.getElementById("reloadClass")?.addEventListener("click", () => {
    loadProfilesData();
  });

  // ===== Level button click =====
  levelBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;

      currentLevel = String(btn.dataset.level || "");

      setTab("search");
      showLevel();

      if (role !== "FT") {
        if (classInput) {
          classInput.value = "";
          classInput.disabled = false;
        }
        if (classInput2) {
          classInput2.value = "";
          classInput2.disabled = false;
        }
      }

      if (nameInput) {
        nameInput.value = "";
      }

      hideNameList();
      cachedRows = [];
      lastClassRows = [];

      showStatus("Classes loading. Please wait");
      try {
        const data = await fetchClasses(currentLevel);
        const classes = data.classes || [];
        populateClassDropdowns(classes, role === "FT" ? ftClass : "");
      } catch (err) {
        populateClassDropdowns([], role === "FT" ? ftClass : "");
      } finally {
        hideStatus();
      }

      if (role === "FT" && ftClass) {
        if (classInput) {
          classInput.value = ftClass;
          classInput.disabled = true;
        }
        if (classInput2) {
          classInput2.value = ftClass;
          classInput2.disabled = true;
        }
      }

      await loadProfilesData();
    });
  });

  // Optional auto-open FT own level on load:
  // if (role === "FT" && ftLevel) {
  //   const btn = levelBtns.find(b => b.dataset.level === String(ftLevel));
  //   if (btn && !btn.disabled) btn.click();
  // }

})();