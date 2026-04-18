(function(){
  
 
 // ==== Camera button ====
  const CAM_PATH = "/shared/camera/index.html";
  const camBtn = document.querySelector('.grid .tile[aria-label="camera"], .tile[aria-label="Camera"]');
  if (camBtn) camBtn.addEventListener('click', ()=> location.assign(CAM_PATH));

  // ==== Displays button ====
  const DISPLAY_PATH = "/shared/displays/index.html";
  const dispBtn = document.querySelector('.grid .tile[aria-label="displays"], .tile[aria-label="Displays"]');
  if (dispBtn) dispBtn.addEventListener('click', ()=> location.assign(DISPLAY_PATH));

  // ==== Letters button ====
  const LETTERS_PATH = "/shared/letters/index.html";
  const lettersBtn = document.querySelector('.grid .tile[aria-label="letters"], .tile[aria-label="Letters"]');
  if (lettersBtn) lettersBtn.addEventListener('click', ()=> location.assign(LETTERS_PATH));

// ==== Attendance button ====
const ATTENDANCE_PATH = "/shared/attendance/index.html";
const attendanceBtn = document.querySelector('.grid .tile[aria-label="attendances"], .tile[aria-label="Attendances"]');
attendanceBtn?.addEventListener('click', () => location.assign(ATTENDANCE_PATH));



})();
