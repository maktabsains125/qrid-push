/* /shared/review/reports.js (UPDATED)
 * Change: ALL "Daily Report" buttons go to the fixed REGIS daily reports page.
 * URL: https://mspsbs-registration.netlify.app/shared/review/regis/daily-reports.html
 */

/* ===== CONFIG ===== */

// Call Netlify function (proxy to GAS)
const REPORTS_WEBAPP_URL = "/.netlify/functions/reports";

const ALLOWED_ROLES = ["REGIS", "ADMIN", "CODER", "WELFARE"];
const LEVEL_ORDER   = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 12", "Year 13"];

// ✅ Fixed Daily Reports page (same for all levels)
const FIXED_DAILY_REPORT_URL =
  "https://mspsbs-registration.netlify.app/shared/review/regis/daily-reports.html";

document.addEventListener("DOMContentLoaded", () => {
  const roleMessageEl  = document.getElementById("roleMessage");
  const cardsContainer = document.getElementById("cardsContainer");
  const xBtn           = document.getElementById("xBtn");

  // ---- read session from Auth.js ----
  const who = window.Auth && typeof Auth.who === "function" ? Auth.who() : null;
  if (!who) { location.href = "/"; return; }

  const USER_ROLE = String(who.role || "").toUpperCase().trim();

  // X button – go to attendance dashboard
  if (xBtn) {
    xBtn.addEventListener("click", () => {
      location.href = "/shared/attendance/index.html";
    });
  }

  // Check role: only REGIS, ADMIN, CODER, WELFARE
  if (!ALLOWED_ROLES.includes(USER_ROLE)) {
    roleMessageEl.textContent = "Access denied. Your role is not allowed to view this page.";
    cardsContainer.innerHTML = "";
    return;
  }

  if (USER_ROLE === "WELFARE") {
    roleMessageEl.textContent =
      "WELFARE: Daily reports are disabled. You may open monthly reports only.";
  } else {
    roleMessageEl.textContent = "";
  }

  // ===== Kebab (shared JS) =====
  // Requires: <script src="/shared/stylesheet/left-kebab.js" defer></script>
  if (window.LeftKebab && typeof LeftKebab.init === "function") {
    LeftKebab.init({ storagePrefix: "reports" });
  }

  // Load reports (still needed for monthly buttons)
  loadReports(cardsContainer, USER_ROLE);
});

async function loadReports(container, USER_ROLE) {
  container.innerHTML = "Loading…";

  try {
    const url = REPORTS_WEBAPP_URL + "?mode=getReports";
    const res = await fetch(url, { method: "GET" });

    if (!res.ok) throw new Error("Network error " + res.status);

    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Backend error");

    buildCards(container, json.data || {}, USER_ROLE);
  } catch (err) {
    console.error(err);
    container.innerHTML =
      '<div class="empty-text">Unable to load reports. Please try again later.</div>';
  }
}

function buildCards(container, data, USER_ROLE) {
  container.innerHTML = "";

  LEVEL_ORDER.forEach((level) => {
    const items = data[level] || [];
    const card = document.createElement("section");
    card.className = "level-card";

    // Header
    const header = document.createElement("div");
    header.className = "level-header";

    const title = document.createElement("div");
    title.className = "level-title";
    title.textContent = level;

    const tag = document.createElement("div");
    tag.className = "level-tag";
    tag.textContent = "Reports";

    header.appendChild(title);
    header.appendChild(tag);
    card.appendChild(header);

    // ===== DAILY SECTION =====
    const dailySec = document.createElement("div");
    dailySec.className = "section-block";

    const dailyTitle = document.createElement("div");
    dailyTitle.className = "section-title";
    dailyTitle.textContent = "DAILY REPORT";
    dailySec.appendChild(dailyTitle);

    const dailyGrid = document.createElement("div");
    dailyGrid.className = "buttons-grid";

    // ✅ Always the same URL (except WELFARE disabled)
    if (USER_ROLE === "WELFARE") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "report-btn-disabled";
      btn.textContent = "Daily Report";
      dailyGrid.appendChild(btn);
    } else {
     const link = document.createElement("a");
     link.className = "report-btn";
     link.href = "/shared/review/regis/daily-reports.html";
     link.textContent = "Daily Report";
	 dailyGrid.appendChild(link);
    }

    dailySec.appendChild(dailyGrid);
    card.appendChild(dailySec);

    // ===== MONTHLY SECTION =====
    const monthlySec = document.createElement("div");
    monthlySec.className = "section-block";

    const monthlyTitle = document.createElement("div");
    monthlyTitle.className = "section-title";
    monthlyTitle.textContent = "MONTHLY REPORTS";
    monthlySec.appendChild(monthlyTitle);

    const monthlyGrid = document.createElement("div");
    monthlyGrid.className = "buttons-grid";

    items.forEach((item) => {
      if (!item.className || !item.monthlyUrl) return;

	const link = document.createElement("a");
	link.className = "report-btn";
	link.href = item.monthlyUrl;
	link.textContent = item.className;

      monthlyGrid.appendChild(link);
    });

    if (!monthlyGrid.hasChildNodes()) {
      const empty = document.createElement("div");
      empty.className = "empty-text";
      empty.textContent = "No monthly reports configured.";
      monthlySec.appendChild(empty);
    } else {
      monthlySec.appendChild(monthlyGrid);
    }

    card.appendChild(monthlySec);
    container.appendChild(card);
  });
}
