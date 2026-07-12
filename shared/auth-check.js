/* ==========================================
   auth-check.js
   Shared JWT verification
   ========================================== */

async function verify(force = false) {

  if (!window.Auth) {
    location.replace("/");
    return null;
  }

  const who = Auth.who();

  if (!who || !who.token) {
    Auth.clear();
    localStorage.removeItem("mspsbs_verified");
    location.replace("/");
    return null;
  }

  // ============================
  // 2-hour verification cache
  // ============================

  if (!force) {

    const cached = JSON.parse(
      localStorage.getItem("mspsbs_verified") || "null"
    );

    const TWO_HOURS = 2 * 60 * 60 * 1000;

    if (
      cached &&
      cached.verified &&
      cached.uid === who.uid &&
      cached.token === who.token &&
      (Date.now() - cached.checkedAt) < TWO_HOURS
    ) {
      return cached;
    }

  }

  try {

    const res = await fetch("/.netlify/functions/verify", {
      method: "POST",
      headers:{
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        token: who.token
      })
    });

    const data = await res.json();

    if (!data.ok || !data.verified) {

      Auth.clear();
      localStorage.removeItem("mspsbs_verified");
      location.replace("/");

      return null;
    }

    // Save verification cache
    localStorage.setItem(
      "mspsbs_verified",
      JSON.stringify({
        ...data,
        token: who.token,
        checkedAt: Date.now()
      })
    );

    return data;

  }
  catch(err){

    console.error(err);

    Auth.clear();
    localStorage.removeItem("mspsbs_verified");
    location.replace("/");

    return null;

  }

}
