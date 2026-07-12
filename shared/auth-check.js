/* ==========================================
   auth-check.js
   Shared JWT verification
   ========================================== */

const AuthCheck = (() => {

  async function verify() {

    // Must have Auth
    if (!window.Auth) {
      location.replace("/");
      return null;
    }

    // Must have local session
    const who = Auth.who();

    if (!who || !who.token) {
      Auth.clear();
      location.replace("/");
      return null;
    }

    try {

      const res = await fetch("/.netlify/functions/verify", {
        method: "POST",
        headers: {
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          token: who.token
        })
      });

      const data = await res.json();

      if (!data.ok || !data.verified) {
        Auth.clear();
        location.replace("/");
        return null;
      }

      return data;

    }
    catch(err){

      console.error(err);

      Auth.clear();
      location.replace("/");

      return null;
    }

  }

  async function requireRole(...allowedRoles){

      const verified = await verify();

      if(!verified) return;

      const role = String(verified.role).toUpperCase();

      if(!allowedRoles.includes(role)){

          location.replace(Auth.routeFor(role));

          return null;
      }

      return verified;

  }

  return {

      verify,
      requireRole

  };

})();
