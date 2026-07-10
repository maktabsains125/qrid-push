(function () {
  "use strict";

  /******************************************************
   * AUTH
   ******************************************************/
  const who = (window.Auth && Auth.who && Auth.who()) || null;

  if (!who) {
    window.location.replace("/");
    return;
  }

  const SCAN_URL = "/.netlify/functions/event-camera";

  const $ = (id) => document.getElementById(id);

  /******************************************************
   * DOM
   ******************************************************/
  const els = {

    btnCamera: $("btnCamera"),
    btnScanner: $("btnScanner"),
    btnManual: $("btnManual"),

    attendanceType: $("attendanceType"),

    status: $("status"),

    result: $("result"),
    resName: $("resName"),
    resId: $("resId"),
    resMark: $("resMark"),
    resTime: $("resTime"),

    closeCard: $("closeCard"),
    nextBtn: $("nextBtn"),

    camDlg: $("camDlg"),
    closeCam: $("closeCam"),
    preview: $("preview"),

    manualDlg: $("manualDlg"),
    closeManual: $("closeManual"),

    manualName: $("manualName"),
    manualId: $("manualId"),
    manualEnter: $("manualEnter"),

  };



  /******************************************************
   * ZXING
   ******************************************************/
 
  let reader = null;
  let busy = false;
  let cameraOpen = false;



  /******************************************************
   * STATUS
   ******************************************************/
  function showStatus(msg){

    if(!els.status) return;

    els.status.textContent = msg;
    els.status.classList.remove("hidden");

  }

  function hideStatus(){

    els.status?.classList.add("hidden");

  }



  /******************************************************
   * RESULT CARD
   ******************************************************/
  function populateCard(data){

    els.resName.textContent =
      data.name || "—";

    els.resId.textContent =
      data.id || "—";

    els.resMark.textContent =
      data.mark || "—";

    els.resTime.textContent =
      data.time || "—";

  }



  function showCard(data){

    populateCard(data);

    els.result.classList.remove("hidden");

  }



  function hideCard(){

    els.result.classList.add("hidden");

  }



  /******************************************************
   * QR PARSER
   ******************************************************/
  function parseQR(text){

    try{

      const obj =
        JSON.parse(text);

      return {

        id: String(obj.id || "").trim(),

        name:
          String(obj.name || "").trim()

      };

    }

    catch(err){

      return null;

    }

  }



  /******************************************************
   * CAMERA
   ******************************************************/
  async function openCamera(){

    if (!reader) {
    reader = new ZXing.BrowserMultiFormatReader();
  }
    
    if(cameraOpen) return;

    busy = false;
    cameraOpen = true;

    hideCard();
    hideStatus();

    els.camDlg.showModal();

    try{

      await reader.decodeFromVideoDevice(

        null,

        els.preview,

        (result)=>{

          if(!result) return;

          if(busy) return;

          busy = true;

          const qr =
            parseQR(
              result.getText()
            );

          if(!qr){

            busy = false;
            return;

          }

          closeCamera();

          processScan(qr);

        }

      );

    }

    catch(err){

      alert(
        "Unable to access camera.\n\n"
        + err.message
      );

      closeCamera();

    }

  }



  function closeCamera(){

    cameraOpen = false;

    try{

      reader?.reset();

    }

    catch(_){}



    try{

      els.camDlg.close();

    }

    catch(_){}



    if(els.preview.srcObject){

      els.preview
        .srcObject
        .getTracks()
        .forEach(t=>t.stop());

      els.preview.srcObject = null;

    }

  }


   /******************************************************
   * POST JSON
   ******************************************************/
  async function postJSON(url, body){

    const response = await fetch(url,{

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify(body)

    });

    const data = await response.json();

if (!response.ok || data.success === false) {

  throw new Error(
    data.message || "Unable to contact server."
  );

}

return data;

  }



  /******************************************************
   * PROCESS SCAN
   ******************************************************/
  async function processScan(qr){

    if(!qr || !qr.id){

      alert("Invalid QR code.");

      busy = false;

      return;

    }

    if (!els.attendanceType.value) {

    alert("Please select Clock In or Clock Out.");

    busy = false;
 
    return;

   }
    
    showStatus("Recording attendance...");

    try{

      const attendanceType =
        els.attendanceType.value;

      const data =
        await postJSON(

          SCAN_URL,

          {

            action:"recordAttendance",

            user: who.code,
            
            id:qr.id,

            attendanceType

          }

        );

      hideStatus();

      showCard({

        name:qr.name,

        id:qr.id,

        mark:
          attendanceType === "clockIn"
            ? "CLOCK IN ✔"
            : "CLOCK OUT ✔",

        time:data.time

      });

    }

    catch(err){

      hideStatus();

      showCard({

        name:"Failed",

        id:qr.id,

        mark:"ERROR",

        time:
          new Date().toLocaleTimeString()

      });

      alert(err.message);

    }

    finally{

      busy = false;

    }

  }



  /******************************************************
   * BUTTONS
   ******************************************************/
  document.addEventListener(
    "DOMContentLoaded",
    ()=>{

      els.btnCamera?.addEventListener(
        "click",
        openCamera
      );

      els.closeCam?.addEventListener(
        "click",
        closeCamera
      );

      els.closeCard?.addEventListener(
        "click",
        hideCard
      );

      els.nextBtn?.addEventListener(
        "click",
        ()=>{

          hideCard();
          hideStatus();

          closeCamera();
          openCamera();

        }
      );

      els.btnScanner?.addEventListener(
        "click",
        ()=>{

          alert(
            "Hardware scanner will be added next."
          );

        }
      );

      els.btnManual?.addEventListener(
        "click",
        ()=>{

          alert(
            "Manual attendance will be added next."
          );

        }
      );

    }
  );

})();
