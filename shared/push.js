/* ==========================================================
   Shared Push Notification Helper
   /shared/push.js
   ========================================================== */

"use strict";

window.Push = (() => {

  const PUSH_API = "/.netlify/functions/push-subscribe";

  const PUSH_PUBLIC_KEY =
    "BIjJvyTjSAwpqPNrMiczDwHUQ8T0v_-ITLvPPMTTPv-mq9Eg0Q79kaJkCFqK1vxmoMOjovQ3GNasnPwYKbWqIvo";

  const PUSH_SW_URL = "/sw.js";

  function isSupported() {
    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }

  function isIosLike() {
    const ua = navigator.userAgent || "";

    const touchMac =
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1;

    return /iPhone|iPad|iPod/.test(ua) || touchMac;
  }

  function isStandalonePwa() {
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true
    );
  }

  function getDeviceId() {

    let id = localStorage.getItem("pushDeviceId");

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("pushDeviceId", id);
    }

    return id;
  }

  function urlBase64ToUint8Array(base64String) {

    const padding =
      "=".repeat((4 - (base64String.length % 4)) % 4);

    const base64 =
      (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const raw = atob(base64);

    return Uint8Array.from(
      [...raw].map(ch => ch.charCodeAt(0))
    );
  }

  async function ensureServiceWorker() {

    let reg = await navigator.serviceWorker.getRegistration("/");

    if (!reg) {
      reg = await navigator.serviceWorker.register(
        PUSH_SW_URL,
        { scope: "/" }
      );
    }

    // Ensure the service worker is active
    await navigator.serviceWorker.ready;

    return reg;
  }

  async function getSubscription() {

    if (!isSupported()) return null;

    const reg = await ensureServiceWorker();

    return reg.pushManager.getSubscription();
  }

  async function saveSubscription(code, subscription) {

    const res = await fetch(PUSH_API, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        mode: "savePushSubscription",

        code,

        deviceId: getDeviceId(),

        subscription

      })

    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error || "Failed to save subscription."
      );
    }

    return data;
  }

  async function refreshSubscription(code) {

    if (!isSupported()) return false;

    if (Notification.permission !== "granted") {
      return false;
    }

    const sub = await getSubscription();

    if (!sub) {
      return false;
    }

    await saveSubscription(
      code,
      sub.toJSON()
    );

    return true;
  }

  async function enableNotifications(code) {

    if (!isSupported()) {
      throw new Error(
        "Push notifications are not supported."
      );
    }

    if (
      isIosLike() &&
      !isStandalonePwa()
    ) {
      throw new Error(
        "On iPhone/iPad, add this app to the Home Screen first."
      );
    }

    let permission = Notification.permission;

    if (permission === "denied") {
      throw new Error(
        "Notifications have been blocked."
      );
    }

    if (permission === "default") {
      permission =
        await Notification.requestPermission();
    }

    if (permission !== "granted") {
      throw new Error(
        "Notification permission not granted."
      );
    }

    const reg =
      await ensureServiceWorker();

    let sub =
      await reg.pushManager.getSubscription();

    if (!sub) {

      sub =
        await reg.pushManager.subscribe({

          userVisibleOnly: true,

          applicationServerKey:
            urlBase64ToUint8Array(PUSH_PUBLIC_KEY)

        });

    }

    await saveSubscription(
      code,
      sub.toJSON()
    );

    return sub;
  }

  return {

    refreshSubscription,

    enableNotifications,

    ensureServiceWorker,

    getSubscription,

    getDeviceId,

    isSupported,

    isIosLike,

    isStandalonePwa

  };

})();
