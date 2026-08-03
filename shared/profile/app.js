/* Profiles app — role-aware buttons + level view + GAS fetch
   + dropdown classes + loading status + modal per student*/

(async function () {

"use strict";

Overlay.showLoading();

try {

const user = await AuthCheck.requireRole(
    "FT",
    "REGIS",
    "ADMIN",
    "HEP",
    "WELFARE",
    "CODER"
);

if (!user) return;

const role = user.role;
const uid  = user.uid;
const code = user.code;

  // ===== CONFIG =====
  const PROFILE_API = "/.netlify/functions";

  // ===== Year in header =====
  const yy = document.getElementById("yy");
  if (yy) yy.textContent = new Date().getFullYear();

  // ===== Views + buttons =====
  const homeView  = document.getElementById("homeView");
  const levelView = document.getElementById("levelView");
  const closeBtn  = document.getElementById("closeBtn");

  // ===== Sections =====
  function showHome() {
    if (homeView) homeView.hidden = false;
    if (levelView) levelView.hidden = true;

    document.body.classList.remove("mode-level");
    document.documentElement.classList.remove("mode-level");

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
    race: F("race"),
    religion: F("religion"),

    bday: F("bday"),
    bmonth: F("bmonth"),
    byear: F("byear"),
   
    bcert: F("bcert"),
    ic: F("ic"),
    bruhims: F("bru-hims"),

    phone: F("phone"), 
    med: F("med"),
    aid: F("aid"),
    welfare: F("welfare"),
    house: F("house"),

    father: F("father"),
    fatherIC: F("fatherIC"),
    fatherCol: F("fatherCol"),
    fatherAdd: F("fatherAdd"),
    fatherMukim: F("fatherMukim"), 
    fatherPostcode: F("fatherPostcode"),
    fatherPhone: F("fatherPhone"),
    fatherOcc: F("fatherOcc"),
    fatherWorkplace: F("fatherWorkplace"),

    mother: F("mother"),
    motherIC: F("motherIC"),
    motherCol: F("motherCol"),
    motherAdd: F("motherAdd"),
    motherMukim: F("motherMukim"),  
    motherPostcode: F("motherPostcode"),
    motherPhone: F("motherPhone"),
    motherOcc: F("motherOcc"),
    motherWorkplace: F("motherWorkplace"),

    guardian: F("guardian"),
    guardianRel: F("guardianRel"),
    guardianIC: F("guardianIC"),
    guardianCol: F("guardianCol"),
    guardianAdd: F("guardianAdd"),
    guardianMukim: F("guardianMukim"), 
    guardianPostcode: F("guardianPostcode"),
    guardianPhone: F("guardianPhone"),
    guardianOcc: F("guardianOcc"),
    guardianWorkplace: F("guardianWorkplace") 
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
  async function fetchClasses(level) {
    const params = new URLSearchParams({
        fn: "profiles.classes",
        level: level
    });
     console.time("fetchClasses");
     const res = await fetch(
    `${PROFILE_API}/profiles-classes?${params.toString()}`
    );
    if (!res.ok) {
        throw new Error("Network error");
    }
 
    const data = await res.json();
    console.timeEnd("fetchClasses");
   
    if (!data.ok) {
        throw new Error(data.error || "Server error");
    }
    return data.classes || [];
}  

async function fetchProfiles(level, clazz) {
    
    const params = new URLSearchParams({
        fn: "profiles.get",
        level: level,
        clazz: clazz
    });

    console.time("fetchProfiles");
   
    const res = await fetch(
   `${PROFILE_API}/profiles-get?${params.toString()}`
   );
    if (!res.ok) {
        throw new Error("Network error");
    }
    const data = await res.json();
    console.timeEnd("fetchProfiles");


    if (!data.ok) {
        throw new Error(data.error || "Server error");
    }

    return data.rows || [];

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
    fields.adm.value             = r["ADM NO."] || "";
    fields.gender.value          = r["GENDER"] || "";
    fields.race.value            = r["RACE"] || "";
    fields.religion.value        = r["RELIGION"] || "";
    fields.bday.value            = r["BIRTH DAY"] || "";
    fields.bmonth.value          = r["BIRTH MONTH"] || "";
    fields.byear.value           = r["BIRTH YEAR"] || "";
    fields.bcert.value           = r["BIRTH CERT"] || "";

    fields.ic.value              = r["IC"] || "";
    fields.bruhims.value         = r["BRU-HIMS"] || "";
    fields.phone.value           = r["PHONE"] || "";
     
    fields.med.value             = r["MEDICAL CONDITION"] || "";
    fields.aid.value             = r["AID"] || "";
    fields.welfare.value         = r["WELFARE"] || "";
    fields.house.value           = r["SPORTSHOUSE"] || "";

    fields.father.value          = r["FATHER"] || "";
    fields.fatherIC.value        = r["FATHER IC"] || "";
    fields.fatherCol.value       = r["FATHER IC COL"] || "";
    fields.fatherAdd.value       = r["FATHER ADDRESS"] || "";
    fields.fatherMukim.value       = r["FATHER MUKIM"] || ""; 
    fields.fatherPostcode.value  = r["FATHER POSTCODE"] || "";
    fields.fatherPhone.value     = r["FATHER PHONE"] || "";
    fields.fatherOcc.value       = r["FATHER OCCUPATION"] || "";
    fields.fatherWorkplace.value = r["FATHER WORKPLACE"] || "";
    
    fields.mother.value          = r["MOTHER"] || "";
    fields.motherIC.value          = r["MOTHER IC"] || "";
    fields.motherCol.value          = r["MOTHER IC COL"] || "";
    fields.motherAdd.value       = r["MOTHER ADDRESS"] || "";
    fields.motherMukim.value       = r["MOTHER MUKIM"] || "";
    fields.motherPostcode.value  = r["MOTHER POSTCODE"] || "";
    fields.motherPhone.value     = r["MOTHER PHONE"] || "";
    fields.motherOcc.value       = r["MOTHER OCCUPATION"] || "";
    fields.motherWorkplace.value = r["MOTHER WORKPLACE"] || "";

    fields.guardian.value           = r["GUARDIAN"] || "";
    fields.guardianIC.value           = r["GUARDIAN IC"] || "";
    fields.guardianCol.value           = r["GUARDIAN IC COL"] || "";
    fields.guardianRel.value        = r["GUARDIAN RELATION"] || "";
    fields.guardianAdd.value        = r["GUARDIAN ADDRESS"] || "";
    fields.guardianMukim.value        = r["GUARDIAN MUKIM"] || "";
    fields.guardianPostcode.value   = r["GUARDIAN POSTCODE"] || "";
    fields.guardianPhone.value      = r["GUARDIAN PHONE"] || "";
    fields.guardianOcc.value        = r["GUARDIAN OCCUPATION"] || "";
    fields.guardianWorkplace.value  = r["GUARDIAN WORKPLACE"] || "";
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
      `<div class="modalLabel">Race</div><div class="modalValue">${studentObj["RACE"] || ""}</div>`,
      `<div class="modalLabel">Religion</div><div class="modalValue">${studentObj["RELIGION"] || ""}</div>`,
      `<div class="modalLabel">DOB</div><div class="modalValue">${fullDOB(studentObj) || ""}</div>`,
      `<div class="modalLabel">Birth cert</div><div class="modalValue">${studentObj["BIRTH CERT"] || ""}</div>`,
      `<div class="modalLabel">IC</div><div class="modalValue">${studentObj["IC"] || ""}</div>`,
      `<div class="modalLabel">BRU-HIMS</div><div class="modalValue">${studentObj["BRU-HIMS"] || ""}</div>`,
      `<div class="modalLabel">Mobile No</div><div class="modalValue">${studentObj["PHONE"] || ""}</div>`,
      `<div class="modalLabel">Medical</div><div class="modalValue">${studentObj["MEDICAL CONDITION"] || ""}</div>`,
      `<div class="modalLabel">Aid</div><div class="modalValue">${studentObj["AID"] || ""}</div>`,
      `<div class="modalLabel">Welfare</div><div class="modalValue">${studentObj["WELFARE"] || ""}</div>`,
      `<div class="modalLabel">Sportshouse</div><div class="modalValue">${studentObj["SPORTSHOUSE"] || ""}</div>`
    );

    htmlParts.push(
      `<div class="modalGroupHead" style="color:#1b3487;">Father</div>`,
      `<div class="modalLabel">Name</div><div class="modalValue">${studentObj["FATHER"] || ""}</div>`,
      `<div class="modalLabel">IC</div><div class="modalValue">${studentObj["FATHER IC"] || ""}</div>`,
      `<div class="modalLabel">IC Colour</div><div class="modalValue">${studentObj["FATHER IC COL"] || ""}</div>`,
      `<div class="modalLabel">Address</div><div class="modalValue">${studentObj["FATHER ADDRESS"] || ""}</div>`,
      `<div class="modalLabel">Mukim</div><div class="modalValue">${studentObj["FATHER MUKIM"] || ""}</div>`,
      `<div class="modalLabel">Postcode</div><div class="modalValue">${studentObj["FATHER POSTCODE"] || ""}</div>`,
      `<div class="modalLabel">Mobile No</div><div class="modalValue">${studentObj["FATHER PHONE"] || ""}</div>`,
      `<div class="modalLabel">Job</div><div class="modalValue">${studentObj["FATHER OCCUPATION"] || ""}</div>`,
      `<div class="modalLabel">Workplace</div><div class="modalValue">${studentObj["FATHER WORKPLACE"] || ""}</div>`
    );

    htmlParts.push(
      `<div class="modalGroupHead" style="color:#ab1f57;">Mother</div>`,
      `<div class="modalLabel">Name</div><div class="modalValue">${studentObj["MOTHER"] || ""}</div>`,
      `<div class="modalLabel">IC</div><div class="modalValue">${studentObj["MOTHER IC"] || ""}</div>`,
      `<div class="modalLabel">IC Colour</div><div class="modalValue">${studentObj["MOTHER IC COL"] || ""}</div>`,
      `<div class="modalLabel">Address</div><div class="modalValue">${studentObj["MOTHER ADDRESS"] || ""}</div>`,
      `<div class="modalLabel">Mukim</div><div class="modalValue">${studentObj["MOTHER MUKIM"] || ""}</div>`,
      `<div class="modalLabel">Postcode</div><div class="modalValue">${studentObj["MOTHER POSTCODE"] || ""}</div>`,
      `<div class="modalLabel">Mobile No</div><div class="modalValue">${studentObj["MOTHER PHONE"] || ""}</div>`,
      `<div class="modalLabel">Job</div><div class="modalValue">${studentObj["MOTHER OCCUPATION"] || ""}</div>`,
      `<div class="modalLabel">Workplace</div><div class="modalValue">${studentObj["MOTHER WORKPLACE"] || ""}</div>`
    );

    htmlParts.push(
      `<div class="modalGroupHead" style="color:#297a1f;">Guardian</div>`,
      `<div class="modalLabel">Name</div><div class="modalValue">${studentObj["GUARDIAN"] || ""}</div>`,
      `<div class="modalLabel">IC</div><div class="modalValue">${studentObj["GUARDIAN IC"] || ""}</div>`,
      `<div class="modalLabel">IC Colour</div><div class="modalValue">${studentObj["GUARDIAN IC COL"] || ""}</div>`,
      `<div class="modalLabel">Relation</div><div class="modalValue">${studentObj["GUARDIAN RELATION"] || ""}</div>`,
      `<div class="modalLabel">Address</div><div class="modalValue">${studentObj["GUARDIAN ADDRESS"] || ""}</div>`,
      `<div class="modalLabel">Mukim</div><div class="modalValue">${studentObj["GUARDIAN MUKIM"] || ""}</div>`,
      `<div class="modalLabel">Postcode</div><div class="modalValue">${studentObj["GUARDIAN POSTCODE"] || ""}</div>`,
      `<div class="modalLabel">Mobile No</div><div class="modalValue">${studentObj["GUARDIAN PHONE"] || ""}</div>`,
      `<div class="modalLabel">Occupation</div><div class="modalValue">${studentObj["GUARDIAN OCCUPATION"] || ""}</div>`,
      `<div class="modalLabel">Workplace</div><div class="modalValue">${studentObj["GUARDIAN WORKPLACE"] || ""}</div>`
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
          <td>${r["RACE"] || ""}</td>
          <td>${r["RELIGION"] || ""}</td>
          <td>${fullDOB(r) || ""}</td>
          <td>${r["BIRTH CERT"] || ""}</td>
          <td>${r["IC"] || ""}</td>
          <td>${r["BRU-HIMS"] || ""}</td>
          <td>${r["PHONE"] || ""}</td>
          <td>${r["MEDICAL CONDITION"] || ""}</td>
          <td>${r["AID"] || ""}</td>
          <td>${r["WELFARE"] || ""}</td>
          <td>${r["SPORTSHOUSE"] || ""}</td>
          <td>${r["FATHER"] || ""}</td>
          <td>${r["FATHER IC"] || ""}</td>
          <td>${r["FATHER IC COL"] || ""}</td>
          <td>${r["FATHER ADDRESS"] || ""}</td>
          <td>${r["FATHER MUKIM"] || ""}</td>
          <td>${r["FATHER POSTCODE"] || ""}</td>
          <td>${r["FATHER PHONE"] || ""}</td>
          <td>${r["FATHER OCCUPATION"] || ""}</td>
          <td>${r["FATHER WORKPLACE"] || ""}</td>
          <td>${r["MOTHER"] || ""}</td>
          <td>${r["MOTHER IC"] || ""}</td>
          <td>${r["MOTHER IC COL"] || ""}</td>
          <td>${r["MOTHER ADDRESS"] || ""}</td>
          <td>${r["MOTHER MUKIM"] || ""}</td>
          <td>${r["MOTHER POSTCODE"] || ""}</td>
          <td>${r["MOTHER PHONE"] || ""}</td>
          <td>${r["MOTHER OCCUPATION"] || ""}</td>
          <td>${r["MOTHER WORKPLACE"] || ""}</td>
          <td>${r["GUARDIAN"] || ""}</td>
          <td>${r["GUARDIAN IC"] || ""}</td>
          <td>${r["GUARDIAN IC COL"] || ""}</td>
          <td>${r["GUARDIAN RELATION"] || ""}</td>
          <td>${r["GUARDIAN ADDRESS"] || ""}</td>
          <td>${r["GUARDIAN MUKIM"] || ""}</td>
          <td>${r["GUARDIAN POSTCODE"] || ""}</td>
          <td>${r["GUARDIAN PHONE"] || ""}</td>
          <td>${r["GUARDIAN OCCUPATION"] || ""}</td>
          <td>${r["GUARDIAN WORKPLACE"] || ""}</td>
        </tr>
      `).join("") || `<tr><td colspan="23">No data.</td></tr>`;

    activateTableRowClicks();
  }

  // ===== Shared loader (single fetch only) =====
    
   async function loadProfilesData() {
    console.time("loadProfilesData");
    const clazz =
        role === "FT"
            ? ftClass
            : (
                classInput2.value ||
                classInput.value
            ).trim().toUpperCase();

    if (!clazz) {
        cachedRows = [];
        lastClassRows = [];
        renderClassTable([]);
        return;
    }

    cachedRows = await fetchProfiles(
        currentLevel,
        clazz
    );

    lastClassRows = cachedRows;
    renderNameList(nameInput.value);
    renderClassTable(cachedRows);
    console.timeEnd("loadProfilesData");

}
  // ===== CLASS CHANGE HANDLER =====
  async function onClassChange() {
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
   await loadProfilesData();
  }


  classInput?.addEventListener("change", onClassChange);
  classInput2?.addEventListener("change", onClassChange);

  // ===== NAME TYPING =====
  nameInput?.addEventListener("input", (e) => {
    renderNameList(e.target.value);
  });

  nameInput?.addEventListener("focus", () => {
    renderNameList("");
  });

  document.addEventListener("click", (e) => {
    if (nameList && !nameList.contains(e.target) && e.target !== nameInput) {
      hideNameList();
    }
  });

  // ===== MANUAL RELOAD BUTTON =====
  document.getElementById("reloadClass")?.addEventListener("click", async () => {
  loadProfilesData();
});

// ===== Level button click =====
levelBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    console.log("Year button clicked");
    console.time("Year Button");
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

    Overlay.showLoading();

    try {

     const classes = await fetchClasses(currentLevel);

populateClassDropdowns(
    classes,
    role === "FT" ? ftClass : ""
);

if (role === "FT") {

    classInput.value = ftClass;
    classInput.disabled = true;

    classInput2.value = ftClass;
    classInput2.disabled = true;

    await loadProfilesData();

}
    } catch (err) {

      console.error(err);
      populateClassDropdowns(
      [],
      role === "FT" ? ftClass : ""
    );

    } finally {
      console.timeEnd("Year Button");
      Overlay.hide();

    }

  });
});

} finally {

  await new Promise(resolve => requestAnimationFrame(resolve));
  Overlay.hide();

}

})();
