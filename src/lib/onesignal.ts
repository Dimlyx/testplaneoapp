import OneSignal from "react-onesignal";

const ONESIGNAL_APP_ID = "4df56ac8-185a-4837-85cd-16adfef1c969";

let initPromise: Promise<void> | null = null;
let initialized = false;

const isUnsupportedEnv = () => {
  if (typeof window === "undefined") return true;
  // Skip in iframes (Lovable preview)
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovableproject-dev.com")
  ) {
    return true;
  }
  // OneSignal needs Service Worker + Push API + Notifications
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return true;
  }
  return false;
};

export const initOneSignal = async (): Promise<void> => {
  if (isUnsupportedEnv()) return;
  if (initPromise) return initPromise;

  initPromise = OneSignal.init({
    appId: ONESIGNAL_APP_ID,
    // Custom path/scope so OneSignal SW does not collide with the
    // Workbox PWA service worker registered at scope "/".
    serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
    serviceWorkerParam: { scope: "/push/onesignal/" },
    allowLocalhostAsSecureOrigin: true,
    // We trigger the prompt manually after technician login.
    autoResubscribe: true,
  })
    .then(() => {
      initialized = true;
    })
    .catch((err) => {
      console.warn("[OneSignal] init failed", err);
      initPromise = null;
    });

  return initPromise;
};

export const isOneSignalReady = () => initialized;

/** Login: bind the OneSignal external_id to the Supabase user id. */
export const loginOneSignal = async (userId: string) => {
  if (isUnsupportedEnv()) return;
  try {
    await initOneSignal();
    if (!initialized) return;
    await OneSignal.login(userId);
  } catch (err) {
    console.warn("[OneSignal] login failed", err);
  }
};

export const logoutOneSignal = async () => {
  if (isUnsupportedEnv()) return;
  try {
    if (!initialized) return;
    await OneSignal.logout();
  } catch (err) {
    console.warn("[OneSignal] logout failed", err);
  }
};

/**
 * Prompt the user for notification permission.
 * Safe to call multiple times — does nothing if already granted/denied.
 */
export const promptNotificationPermission = async () => {
  if (isUnsupportedEnv()) return;
  try {
    await initOneSignal();
    if (!initialized) return;
    const perm = OneSignal.Notifications.permission;
    if (perm === true) return; // already granted
    // Native browser prompt — works on iOS PWA (16.4+) and Android.
    await OneSignal.Notifications.requestPermission();
  } catch (err) {
    console.warn("[OneSignal] permission prompt failed", err);
  }
};
