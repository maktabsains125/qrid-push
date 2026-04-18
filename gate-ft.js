/* gate-ft.js — FT-only page guard and small header fill (anchor version) */
(function () {
  Auth.requireRole("FT");

  const who = Auth.who(); // { uid, code, role }
  const el = document.getElementById("whoami"); // optional

  if (who && el) {
    // UID usually should NOT be shown to users; keep it internal
    el.textContent = `${who.code} (${who.role || "GENERAL"})`;
  }

  // Useful for debugging / backend calls
  if (who?.uid) {
    console.log("UID:", who.uid);
  }

  const s = Auth.load();
  if (s?.role === "FT") {
    console.log(
      "FT session:",
      s.level,
      s.class,
      // anchor replaces reviewid
      s.anchor,
      s.returnid,
      s.profileid,
      "UID:",
      s.uid
    );
  }

  const ft = Auth.ft() || {};
  console.log(
    "FT info:",
    ft.level,
    ft.class,
    // anchor replaces reviewid
    ft.anchor,
    ft.returnid,
    ft.profileid
  );

  const classBadge = document.getElementById("classBadge");
  if (classBadge && (ft.level || ft.class)) {
    classBadge.textContent = `Year ${ft.level}${ft.class}`;
  }
})();
