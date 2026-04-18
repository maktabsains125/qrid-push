/* /shared/trends/app.js — Attendance Trends with % bars + raw labels + kebab actions + white PNG background + PDF + mode toggle
   FIX:
   - Coerce pct/raw series to numbers (handles "12.3", "12.3%", "", null)
   - Prevent JAN (index 0) from appearing as 0/blank due to string values
*/

(function () {
  "use strict";

  // ===== LOCK to signed in user only =====
  const who = (window.Auth && Auth.who && Auth.who()) || null;
  if (!who) {
    window.location.replace("/");
    return; // stop here
  }

  // ===== ROLE GATE: kick out FT, HEP, WELFARE, GENERAL =====
  const role = String(who.role || "").toUpperCase().trim();
  const BLOCKED = ["FT", "HEP", "WELFARE", "GENERAL", ""];

  if (BLOCKED.includes(role)) {
    let dest = "/";
    if (window.Auth && typeof Auth.routeFor === "function" && role) {
      dest = Auth.routeFor(role) || "/";
    }
    window.location.replace(dest);
    return; // stop everything else
  }

  // ===== CONFIG =====
  const PROXY = "/.netlify/functions/trends";
  const AM_YEARS = ["9", "10", "12", "13"];
  const PM_YEARS = ["7", "8"];

  // Display modes
  const MODE_LATE_ABSENT = "lateAbsent";
  const MODE_ON_PRESENT = "onTimePresent";

  // ===== DOM =====
  const $ = (s, root = document) => root.querySelector(s);

  const amWrap      = $("#amWrap");
  const pmWrap      = $("#pmWrap");
  const overallWrap = $("#overallWrap");
  const tabAm       = $("#tabAm");
  const tabPm       = $("#tabPm");
  const tabOverall  = $("#tabOverall");
  const loadStatus  = $("#loadStatus");
  const exitBtn     = $("#exitBtn");

  // Mode toggle DOM (single switch)
  const modeToggle  = document.querySelector(".modeToggle");
  const modeSwitch  = $("#modeSwitch");

  // kebab / overlay DOM
  const kebabBtn = $("#kebabBtn");
  const kebabPanel = $("#kebabPanel");
  const kebabDim = $("#kebabDim");
  const panelCloseBtn = $("#panelCloseBtn");

  const btnTable = $("#btnTable");
  const btnDownload = $("#btnDownload");

  // Download dialog DOM
  const downloadOverlay = $("#downloadOverlay");
  const downloadDim = $("#downloadDim");
  const dlButtons = downloadOverlay
    ? downloadOverlay.querySelectorAll(".dlBtn")
    : [];

  // ===== State =====
  let trends = null;
  let currentMode = MODE_LATE_ABSENT; // default mode

  // ===== Init =====
  addTabHandlers();
  addModeToggleHandlers();
  addExitHandler();
  addKebabHandlers();
  addDownloadHandlers();
  init();

  async function init() {
    showStatus(true);
    try {
      const data = await fetchJson(`${PROXY}?action=json&t=${Date.now()}`);
      trends = data;
      renderAll();
      setTimeout(() => showStatus(false), 400);
    } catch (err) {
      console.error(err);
      alert("Failed to load trends. Please click Refresh.");
      showStatus(false);
    }
  }

  // ===== Handlers =====

  function addExitHandler() {
    if (!exitBtn) return;
    exitBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (document.referrer) history.back();
      else location.href = "/";
    });
  }

  function addModeToggleHandlers() {
    if (!modeToggle || !modeSwitch) return;

    const setMode = (mode) => {
      currentMode = mode;

      // Toggle classes for colours & labels
      modeToggle.classList.toggle("lateAbsent", mode === MODE_LATE_ABSENT);
      modeToggle.classList.toggle("onTime",     mode === MODE_ON_PRESENT);

      // ARIA pressed state (true when On Time / Present)
      const pressed = mode === MODE_ON_PRESENT;
      modeSwitch.setAttribute("aria-pressed", pressed ? "true" : "false");

      // Redraw charts with new mode
      renderAll();
    };

    modeSwitch.addEventListener("click", () => {
      const next =
        currentMode === MODE_LATE_ABSENT ? MODE_ON_PRESENT : MODE_LATE_ABSENT;
      setMode(next);
    });

    // Initial state (Late & Absent, pink, thumb on the left)
    setMode(currentMode);
  }

  function addKebabHandlers() {
    if (kebabBtn) {
      kebabBtn.addEventListener("click", () => {
        openMenu();
      });
    }
    if (panelCloseBtn) {
      panelCloseBtn.addEventListener("click", closeMenu);
    }
    if (kebabDim) {
      kebabDim.addEventListener("click", closeMenu);
    }

    if (btnTable) {
      btnTable.addEventListener("click", () => {
        // Go to Attendance Table page in same folder
        window.location.href = "table.html";
      });
    }
  }

  function addDownloadHandlers() {
    if (btnDownload && downloadOverlay) {
      btnDownload.addEventListener("click", () => {
        openDownloadDialog();
      });
    }

    if (downloadDim) {
      downloadDim.addEventListener("click", () => {
        closeDownloadDialog();
      });
    }

    dlButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const choice = btn.dataset.choice || "none";

        if (choice === "none") {
          closeDownloadDialog();
          return;
        }

        try {
          // Charts & Both => PDF (4 charts/page)
          if (choice === "charts" || choice === "charts-pdf" || choice === "both") {
            await downloadChartsPDF();
          }

          // Tables & Both => CSV via JS (formatted as %)
          if (choice === "tables" || choice === "both") {
            await downloadTables();
          }
        } catch (err) {
          console.error(err);
          alert("Download failed. Please try again.");
        } finally {
          closeDownloadDialog();
        }
      });
    });
  }

  function openMenu() {
    if (!kebabPanel) return;
    kebabPanel.hidden = false;
    kebabPanel.setAttribute("aria-hidden", "false");
  }

  function closeMenu() {
    if (!kebabPanel) return;
    kebabPanel.hidden = true;
    kebabPanel.setAttribute("aria-hidden", "true");
  }

  function openDownloadDialog() {
    if (!downloadOverlay) return;
    downloadOverlay.hidden = false;
    downloadOverlay.setAttribute("aria-hidden", "false");
  }

  function closeDownloadDialog() {
    if (!downloadOverlay) return;
    downloadOverlay.hidden = true;
    downloadOverlay.setAttribute("aria-hidden", "true");
  }

  function addTabHandlers() {
    const setActive = (tab) => {
      [tabAm, tabPm, tabOverall].forEach((t) =>
        t.classList.toggle("active", t === tab)
      );
      amWrap.classList.toggle("hidden", tab !== tabAm);
      pmWrap.classList.toggle("hidden", tab !== tabPm);
      overallWrap.classList.toggle("hidden", tab !== tabOverall);
    };
    tabAm.addEventListener("click", () => setActive(tabAm));
    tabPm.addEventListener("click", () => setActive(tabPm));
    tabOverall.addEventListener("click", () => setActive(tabOverall));
  }

  function showStatus(on) {
    if (loadStatus) loadStatus.classList.toggle("hidden", !on);
  }

  // ===== Rendering =====

  function renderAll() {
    if (!trends) return;
    renderYearCards(amWrap, AM_YEARS);
    renderYearCards(pmWrap, PM_YEARS);
    renderOverall(overallWrap);
  }

  function renderYearCards(container, years) {
    container.innerHTML = "";
    if (!trends || !trends.years) return;

    const totals = (trends && trends.totals) || {};

    years.forEach((yr) => {
      const info = trends.years[yr];
      if (!info) return;
      const totalStudents = totals[yr] ?? null;
      container.appendChild(makeYearCard(yr, info, totalStudents));
    });
  }

  function renderOverall(container) {
    container.innerHTML = "";
    if (!trends) return;

    const o =
      trends.overall || { late: { pct: [], raw: [] }, absent: { pct: [], raw: [] } };

    const totals = trends.totals || {};
    const overallTotal = totals.overall ?? null;

    if (currentMode === MODE_LATE_ABSENT) {
      // === Original behaviour: Late + Absent ===
      const lateTitle = overallTotal
        ? `All Levels — Late (%) (${overallTotal} students)`
        : "All Levels — Late (%)";

      const absentTitle = overallTotal
        ? `All Levels — Absent (%) (${overallTotal} students)`
        : "All Levels — Absent (%)";

      container.appendChild(
        makeChartBox(lateTitle, trends.months, o.late.pct, o.late.raw)
      );
      container.appendChild(
        makeChartBox(absentTitle, trends.months, o.absent.pct, o.absent.raw)
      );
    } else {
      // === Derived mode: On Time + Present ===
      const derived = computeOnTimePresent(o, overallTotal);

      const onTitle = overallTotal
        ? `All Levels — On Time (%) (${overallTotal} students)`
        : "All Levels — On Time (%)";

      const presentTitle = overallTotal
        ? `All Levels — Present (%) (${overallTotal} students)`
        : "All Levels — Present (%)";

      container.appendChild(
        makeChartBox(onTitle, trends.months, derived.onTime.pct, derived.onTime.raw)
      );
      container.appendChild(
        makeChartBox(presentTitle, trends.months, derived.present.pct, derived.present.raw)
      );
    }
  }

  function makeYearCard(year, info, totalStudents) {
    const card = document.createElement("article");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "cardHead";

    head.textContent = totalStudents
      ? `Year ${year} — ${totalStudents} students`
      : `Year ${year}`;

    const body = document.createElement("div");
    body.className = "cardBody";

    if (currentMode === MODE_LATE_ABSENT) {
      // === Original behaviour: Late + Absent ===
      const lateTitle = totalStudents
        ? `Late (%) — Year ${year} (${totalStudents} students)`
        : `Late (%) — Year ${year}`;

      const absentTitle = totalStudents
        ? `Absent (%) — Year ${year} (${totalStudents} students)`
        : `Absent (%) — Year ${year}`;

      body.appendChild(
        makeChartBox(lateTitle, trends.months, info.late.pct, info.late.raw)
      );
      body.appendChild(
        makeChartBox(absentTitle, trends.months, info.absent.pct, info.absent.raw)
      );
    } else {
      // === Derived mode: On Time + Present ===
      const derived = computeOnTimePresent(info, totalStudents);

      const onTitle = totalStudents
        ? `On Time (%) — Year ${year} (${totalStudents} students)`
        : `On Time (%) — Year ${year}`;

      const presentTitle = totalStudents
        ? `Present (%) — Year ${year} (${totalStudents} students)`
        : `Present (%) — Year ${year}`;

      body.appendChild(
        makeChartBox(onTitle, trends.months, derived.onTime.pct, derived.onTime.raw)
      );
      body.appendChild(
        makeChartBox(presentTitle, trends.months, derived.present.pct, derived.present.raw)
      );
    }

    card.appendChild(head);
    card.appendChild(body);
    return card;
  }

  // ===== FIX: coerce series to numeric arrays (handles "12.3", "12.3%", "", null) =====
  function toNumPctArray_(arr) {
    return (arr || []).map((v) => {
      const s = String(v ?? "").trim();
      if (!s) return 0;
      const cleaned = s.replace("%", "");
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    });
  }

  function toNumRawArray_(arr) {
    return (arr || []).map((v) => {
      const s = String(v ?? "").trim();
      if (!s) return 0;
      const cleaned = s.replace(/[, ]/g, "");
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    });
  }

  function makeChartBox(title, monthsFull, pctSeries, rawSeries) {
    const labels = (monthsFull || []).map((m) => String(m || "").slice(0, 3));

    // ✅ Ensure Chart.js always receives numbers
    const pct = toNumPctArray_(pctSeries);
    const raw = toNumRawArray_(rawSeries);

    const wrap = document.createElement("div");
    wrap.className = "chartBox";

    const h = document.createElement("div");
    h.className = "chartTitle";
    h.textContent = title;

    const canvas = document.createElement("canvas");

    const safeTitle = title
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]+/g, "");
    canvas.dataset.filename = `trends_${safeTitle || "chart"}.png`;
    canvas.dataset.title = title;

    wrap.appendChild(h);
    wrap.appendChild(canvas);

    queueMicrotask(() => {
      drawBarChart(canvas, labels, pct, raw);
    });

    return wrap;
  }

  function drawBarChart(canvas, labels, pct, raw) {
    const ctx = canvas.getContext("2d");
    const peach = getCssVar("--peach") || "#efc0a8";

    // Clean old chart if exists
    if (canvas.__chart) {
      canvas.__chart.destroy();
      canvas.__chart = null;
    }

    // Dynamic Y max
    const safeVals = (pct || []).map((v) =>
      typeof v === "number" && isFinite(v) ? v : 0
    );
    const maxVal = safeVals.length ? Math.max(...safeVals) : 0;

    let yMax = 10;
    if (maxVal > 10) {
      yMax = Math.ceil(maxVal + 1);
    }
    if (yMax > 100) yMax = 100;

    // Plugin to draw % labels above bars
    const RawLabelPlugin = {
      id: "rawLabels",
      afterDatasetsDraw(chart, args, opts) {
        const { ctx } = chart;
        const values = opts.values || [];
        const meta = chart.getDatasetMeta(0);

        meta.data.forEach((bar, i) => {
          const v = values[i];
          if (v == null) return;

          const num = typeof v === "number" && isFinite(v) ? v : null;
          if (num === null || num === 0) return;

          const { x, y } = bar.tooltipPosition();
          ctx.save();
          ctx.font = "8px system-ui, -apple-system, Segoe UI, Roboto, Arial";
          ctx.fillStyle = "#555";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(num.toFixed(1) + "%", x, y - 2);
          ctx.restore();
        });
      },
    };

    // Plugin to ensure white background for PNG/PDF exports
    const WhiteBgPlugin = {
      id: "whiteBackground",
      beforeDraw(chart) {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      },
    };

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: pct,
            backgroundColor: peach,
            borderColor: "#00000020",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        // Higher pixel density for sharper PDFs
        devicePixelRatio: 3,

        layout: { padding: { bottom: 12 } },
        resizeDelay: 100,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const i = c.dataIndex;
                const p = pct[i] ?? 0;
                const r = raw[i] ?? 0;
                return ` ${p.toFixed(2)}% (${r})`;
              },
            },
          },
          rawLabels: { values: pct },
          whiteBackground: {},
        },

        scales: {
          x: {
            ticks: {
              autoSkip: true,
              maxRotation: 0,
            },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            max: yMax,
            grid: { color: "#eee" },
            ticks: {
              stepSize: 1,
              callback: (v) => `${v}%`,
            },
          },
        },
      },
      plugins: [RawLabelPlugin, WhiteBgPlugin],
    });

    canvas.__chart = chart;
  }

  // ===== Derived ON-TIME & PRESENT helper =====
  function computeOnTimePresent(info, totalStudents) {
    const latePct   = (info && info.late   && info.late.pct)   || [];
    const absentPct = (info && info.absent && info.absent.pct) || [];
    const len = Math.max(latePct.length, absentPct.length);

    const onTimePct   = new Array(len).fill(0);
    const presentPct  = new Array(len).fill(0);
    const onTimeRaw   = new Array(len).fill(0);
    const presentRaw  = new Array(len).fill(0);

    const hasTotal =
      typeof totalStudents === "number" && isFinite(totalStudents) && totalStudents > 0;
    const total = hasTotal ? totalStudents : 0;

    for (let i = 0; i < len; i++) {
      const Lp = Number.isFinite(latePct[i])   ? latePct[i]   : 0;
      const Ap = Number.isFinite(absentPct[i]) ? absentPct[i] : 0;

      let presP = 100 - Ap;
      let onP   = 100 - Ap - Lp;

      if (presP < 0) presP = 0;
      if (presP > 100) presP = 100;
      if (onP < 0) onP = 0;
      if (onP > 100) onP = 100;

      presentPct[i] = presP;
      onTimePct[i]  = onP;

      if (hasTotal) {
        presentRaw[i] = Math.round((presP / 100) * total);
        onTimeRaw[i]  = Math.round((onP  / 100) * total);
      }
    }

    return {
      onTime:  { pct: onTimePct,  raw: onTimeRaw },
      present: { pct: presentPct, raw: presentRaw },
    };
  }

  // ===== Download helpers =====

  async function downloadTables() {
    const url = `${PROXY}?action=tables&t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    const headersLevels = data.headersLevels || [];
    const rowsLevels = data.rowsLevels || [];
    const headersGroups = data.headersGroups || [];
    const rowsGroups = data.rowsGroups || [];

    const lines = [];

    lines.push("Table by levels");
    headersLevels.forEach((row) => {
      lines.push(row.map(formatCellForCsv).join(","));
    });
    rowsLevels.forEach((row) => {
      const hasValue = row.some(
        (v) => v !== "" && v !== null && typeof v !== "undefined"
      );
      if (!hasValue) return;
      lines.push(row.map(formatCellForCsv).join(","));
    });

    lines.push("");

    lines.push("Table by groupings");
    headersGroups.forEach((row) => {
      lines.push(row.map(formatCellForCsv).join(","));
    });
    rowsGroups.forEach((row) => {
      const hasValue = row.some(
        (v) => v !== "" && v !== null && typeof v !== "undefined"
      );
      if (!hasValue) return;
      lines.push(row.map(formatCellForCsv).join(","));
    });

    const csvText = lines.join("\r\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "attendance-tables.csv";
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
  }

  function formatCellForCsv(cell) {
    if (cell === null || typeof cell === "undefined" || cell === "") return "";

    let out;
    if (typeof cell === "number") {
      if (cell >= 0 && cell <= 1) {
        out = (cell * 100).toFixed(2) + "%";
      } else {
        out = String(cell);
      }
    } else {
      out = String(cell);
    }

    if (out.includes('"') || out.includes(",") || out.includes("\n")) {
      return '"' + out.replace(/"/g, '""') + '"';
    }
    return out;
  }

  // CHARTS PDF: 4 charts per page (2×2), with titles (HARDENED)
  async function downloadChartsPDF() {
    const jsPDF =
      (window.jspdf && window.jspdf.jsPDF) ||
      window.jsPDF;

    if (!jsPDF) {
      alert("PDF export is not available (jsPDF not loaded).");
      return;
    }

    const canvases = Array.from(document.querySelectorAll(".chartBox canvas"));
    if (!canvases.length) {
      alert("No charts found.");
      return;
    }

    const isFinitePos = (n) => typeof n === "number" && isFinite(n) && n > 0;
    const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

    const wraps = [amWrap, pmWrap, overallWrap].filter(Boolean);
    const prevHidden = wraps.map((el) => el.classList.contains("hidden"));
    wraps.forEach((el) => el.classList.remove("hidden"));

    try {
      canvases.forEach((c) => {
        if (c.__chart) {
          try {
            c.__chart.resize();
            c.__chart.update("none");
          } catch (_) {}
        }
      });

      await nextFrame();
      await nextFrame();

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const marginX = 20;
      const marginY = 20;
      const cols = 2;
      const rows = 2;
      const perPage = cols * rows;

      const cellW = (pageW - marginX * 2) / cols;
      const cellH = (pageH - marginY * 2) / rows;

      const titleFontSize = 9;
      const titleTopOffset = 12;
      const titleChartGap = 8;

      let added = 0;

      for (let idx = 0; idx < canvases.length; idx++) {
        const canvas = canvases[idx];

        if (canvas.__chart) {
          try { canvas.__chart.update("none"); } catch (_) {}
        }

        const rect = canvas.getBoundingClientRect();
        if (!isFinitePos(rect.width) || !isFinitePos(rect.height)) {
          console.warn("Skipping 0-size canvas:", canvas);
          continue;
        }

        const imgData = canvas.toDataURL("image/png", 1.0);
        if (!imgData || typeof imgData !== "string") continue;

        let props;
        try {
          props = pdf.getImageProperties(imgData);
        } catch (e) {
          console.warn("Skipping canvas (bad image props):", e);
          continue;
        }

        const imgPxW = props && props.width;
        const imgPxH = props && props.height;
        if (!isFinitePos(imgPxW) || !isFinitePos(imgPxH)) {
          console.warn("Skipping canvas (invalid image size):", imgPxW, imgPxH);
          continue;
        }

        const posInPage = added % perPage;
        const col = posInPage % cols;
        const row = Math.floor(posInPage / cols);

        if (posInPage === 0 && added > 0) pdf.addPage();

        const cellX = marginX + col * cellW;
        const cellY = marginY + row * cellH;

        const title =
          canvas.dataset.title ||
          (canvas.previousElementSibling && canvas.previousElementSibling.textContent) ||
          "";

        if (title) {
          pdf.setFontSize(titleFontSize);
          const maxTextW = cellW - 8;
          const lines = pdf.splitTextToSize(String(title), maxTextW);
          pdf.text(lines, cellX + 4, cellY + titleTopOffset);
        }

        const chartTop = cellY + titleTopOffset + titleChartGap;
        const availableH = cellH - titleTopOffset - titleChartGap - 6;
        const availableW = cellW;

        const ratio = Math.min(availableW / imgPxW, availableH / imgPxH);
        const imgW = imgPxW * ratio;
        const imgH = imgPxH * ratio;

        if (!isFinitePos(imgW) || !isFinitePos(imgH)) {
          console.warn("Skipping canvas (bad scaled size):", imgW, imgH);
          continue;
        }

        const x = cellX + (availableW - imgW) / 2;
        const y = chartTop;

        if (![x, y, imgW, imgH].every((n) => typeof n === "number" && isFinite(n))) {
          console.warn("Skipping canvas (invalid coords):", x, y, imgW, imgH);
          continue;
        }

        pdf.addImage(imgData, "PNG", x, y, imgW, imgH);
        added++;
      }

      if (!added) {
        alert("No charts could be exported (charts may still be hidden or 0-size).");
        return;
      }

      pdf.save("Attendance_Trends_Charts.pdf");
    } catch (err) {
      console.error(err);
      alert("PDF export failed.");
    } finally {
      wraps.forEach((el, i) => el.classList.toggle("hidden", prevHidden[i]));
    }
  }

  // ===== Utils =====
  async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function getCssVar(name) {
    const s = getComputedStyle(document.documentElement).getPropertyValue(name);
    return s && s.trim();
  }
})();
