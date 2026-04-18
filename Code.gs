<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
  <title>Coder Dashboard</title>

  <!-- Shared styles -->
  <link rel="stylesheet" href="/shared/style.css"/>
  <link rel="stylesheet" href="/shared/kebab/kebab.css"/>

  <!-- Shared scripts -->
  <script defer src="/shared/kebab/kebab.js"></script>
</head>
<body>
  <div class="app">

    <!-- ===== Top purple container ===== -->
    <header class="top">
      <div class="welcome">
        <h1>WELCOME</h1>
        <div class="user" id="whoami">[USER]</div>
      </div>

      <!-- Right side: logo + kebab menu -->
      <div class="right">
        <div class="logoWrap" aria-hidden="true">
          <div class="logoCircle">
            <img src="/shared/logo512.png" alt="School Logo" onerror="this.style.display='none'"/>
          </div>
        </div>

        <!-- Kebab (three-dots) button -->
        <button class="kebab" id="menuBtn" aria-label="Menu" title="Menu">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <circle cx="12" cy="5" r="2"></circle>
            <circle cx="12" cy="12" r="2"></circle>
            <circle cx="12" cy="19" r="2"></circle>
          </svg>
        </button>
      </div>

      <script>
        document.addEventListener("DOMContentLoaded", () => {
          document.getElementById("menuBtn")?.addEventListener("click", () => window.Kebab?.open());
          document.addEventListener("kebab:task", () => console.log("Task clicked from kebab panel"));
        });
      </script>
    </header>

    <!-- ===== Peach container ===== -->
    <section class="peach">
      <div class="peachText">MS Dashboard</div>
    </section>

    <!-- ===== Grey container (2×2 grid) ===== -->
    <main class="panel">
      <div class="grid">
        <button class="tile" aria-label="camera">
          <img src="/shared/icons/Camera100.png" alt="">
        </button>
        <button class="tile" aria-label="displays">
          <!-- WARNING: Displays100.png is not in your shared/icons; add it or swap to an existing one -->
          <img src="/shared/icons/Review100.png" alt="">
        </button>
        <button class="tile" aria-label="attendances">
          <!-- Add Attendances100.png to shared/icons or swap -->
          <img src="/shared/icons/Monthly100.png" alt="">
        </button>
        <button class="tile" aria-label="profile_max">
          <!-- Add ProfileMax100.png or swap -->
          <img src="/shared/icons/Profile100.png" alt="">
        </button>
        <button class="tile" aria-label="ft_list">
          <!-- Add FTList100.png or swap -->
          <img src="/shared/icons/Review100.png" alt="">
        </button>
        <button class="tile" aria-label="transfer">
          <!-- Add Transfer100.png or swap -->
          <img src="/shared/icons/Review100.png" alt="">
        </button>
        <button class="tile" aria-label="config">
          <!-- Add Config100.png or swap -->
          <img src="/shared/icons/Review100.png" alt="">
        </button>
        <button class="tile" aria-label="gdrive">
          <!-- Add GDrive100.png or swap -->
          <img src="/shared/icons/Review100.png" alt="">
        </button>
      </div>
    </main>

    <!-- ===== Bottom purple container ===== -->
    <footer class="bottom"></footer>

  </div> <!-- /app -->

  <!-- ===== Auth + whoami ===== -->
  <script src="/auth.js"></script>
  <script>
    // tiny helper: prints "CODE (ROLE)" if role exists, else just "CODE"
    function setWhoami(selector = '#whoami') {
      const who = Auth.who();
      const el  = document.querySelector(selector);
      if (!who || !el) return;
      const r = String(who.role || '').trim();
      el.textContent = r ? `${who.code} (${r})` : `${who.code}`;
    }

    Auth.requireRole('CODER');   // restrict page to CODER
    setWhoami('#whoami');        // will render e.g. "SAN (CODER)"

    // multi-tab logout sync
    window.addEventListener('storage', e=>{
      if (e.key === 'ms_logout_broadcast') location.replace('/?logout=1');
    });
  </script>
</body>
</html>
