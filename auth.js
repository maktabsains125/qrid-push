/* ===== Auth helpers (shared) — hardened FT edition (anchor) =====
 * UPDATE:
 * - Supports session.uid (Unique ID from Sheet1 col L)
 * - Auth.who() returns { uid, code, role }
 * - FT config uses: level, class, anchor (replaces reviewid)
 */

const WEBAPP_URL = "/.netlify/functions/login";

const ROLE_ROUTES = {
  FT:       "/roles/form-teacher",
  REGIS:    "/roles/regis",
  ADMIN:    "/roles/admin",
  WELFARE:  "/roles/welfare",
  HEP:      "/roles/hep",
  CODER:    "/roles/coder",
  GENERAL:  "/roles/general",
  "":       "/roles/general",
};

const Auth = {
  key: "mspsbs_session",

  load(){
    try{
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;

      const s = JSON.parse(raw || "null");
      if (!s) return null;

      if (s.role) s.role = String(s.role).toUpperCase();

      if (s.uid != null)  s.uid  = String(s.uid).trim();
      if (s.code != null) s.code = String(s.code).trim().toUpperCase();

      // ✅ Hard requirement: uid+code must exist for a valid session
      const hasUid  = !!String(s.uid || "").trim();
      const hasCode = !!String(s.code || "").trim();
      if (!hasUid || !hasCode) {
        this.clear(); this.clearFtKeys();
        return null;
      }

      if (typeof s.expires_at === "number" && isFinite(s.expires_at)) {
        if (s.expires_at > 0 && s.expires_at < 1e12) {
          s.expires_at = s.expires_at * 1000;
          localStorage.setItem(this.key, JSON.stringify(s));
        }

        if (Date.now() > s.expires_at){
          this.clear(); this.clearFtKeys();
          return null;
        }
      }

      return s;
    }catch{
      return null;
    }
  },

  save(s){
    if (!s) return;

    if (s.role) s.role = String(s.role).toUpperCase();
    if (s.uid != null)  s.uid  = String(s.uid).trim();
    if (s.code != null) s.code = String(s.code).trim().toUpperCase();

    if (typeof s.expires_at !== "number" || !isFinite(s.expires_at)){
      s.expires_at = Date.now() + 5 * 365 * 24 * 60 * 60 * 1000;
    } else {
      if (s.expires_at > 0 && s.expires_at < 1e12) {
        s.expires_at = s.expires_at * 1000;
      }
    }

    localStorage.setItem(this.key, JSON.stringify(s));
  },

  clear(){ localStorage.removeItem(this.key); },

  clearFtKeys(){
    try{
      localStorage.removeItem("ms_level");
      localStorage.removeItem("ms_class");
      localStorage.removeItem("ms_anchor");   // ✅ was ms_reviewid
      localStorage.removeItem("ms_returnid");
      localStorage.removeItem("ms_profileid");
    }catch{}
  },

  ft(){
    const s = this.load();
    if (s?.role === "FT") {
      return {
        level:     s.level     || "",
        class:     s.class     || "",
        anchor:    s.anchor    || "",  // ✅ was reviewid
        returnid:  s.returnid  || "",
        profileid: s.profileid || "",
      };
    }
    return { level:"", class:"", anchor:"", returnid:"", profileid:"" };
  },

  routeFor(role){
    const r = (role || "").toUpperCase();
    return ROLE_ROUTES[r] || "/roles/general";
  },

  who(){
    const s = this.load();
    return s ? { uid: s.uid || "", code: s.code, role: s.role } : null;
  },

  requireRole(req){
    const s = this.load();
    if (!s){ location.href = "/"; return; }
    if (req && (s.role || "").toUpperCase() !== String(req).toUpperCase()){
      location.href = this.routeFor(s.role);
    }
  },

  requireRoleAndUid(req){
    const s = this.load();
    if (!s){ location.href = "/"; return; }

    const uidOk  = !!String(s.uid||"").trim();
    const codeOk = !!String(s.code||"").trim();
    if (!uidOk || !codeOk) { this.clear(); this.clearFtKeys(); location.href="/"; return; }

    if (req && (s.role || "").toUpperCase() !== String(req).toUpperCase()){
      location.href = this.routeFor(s.role);
    }
  },

  async waitWho(maxMs = 1400, stepMs = 80){
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs){
      const w = this.who();
      if (w) return w;
      await new Promise(r => setTimeout(r, stepMs));
    }
    return null;
  }
};

window.Auth = Auth;
if (window.Auth) { Auth.CAMERA_PATH = "/shared/camera/index.html"; }
