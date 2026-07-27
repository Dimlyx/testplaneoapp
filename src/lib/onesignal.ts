import OneSignal from "react-onesignal";

const ONESIGNAL_APP_ID = "4df56ac8-185a-4837-85cd-16adfef1c969";

let initPromise: Promise<void> | null = null;
let initialized = false;
/** Last user id we were asked to bind. Re-applied whenever the SDK becomes ready. */
let pendingUserId: string | null = null;
let listenersAttached = false;

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

/** Attach listeners so the external_id is (re)bound as soon as a subscription exists. */
const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  try {
    OneSignal.User.PushSubscription.addEventListener("change", () => {
      if (pendingUserId) void bindExternalId(pendingUserId);
    });
    OneSignal.Notifications.addEventListener("permissionChange", () => {
      if (pendingUserId) void bindExternalId(pendingUserId);
    });
  } catch (err) {
    console.warn("[OneSignal] listener attach failed", err);
  }
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
      attachListeners();
      // If a login was requested before the SDK was ready, apply it now.
      if (pendingUserId) void bindExternalId(pendingUserId);
    })
    .catch((err) => {
      console.warn("[OneSignal] init failed", err);
      initPromise = null;
    });

  return initPromise;
};

export const isOneSignalReady = () => initialized;

/**
 * Bind the external_id and verify it actually landed on the device record.
 * Retries a few times because the alias call silently no-ops while the
 * subscription record is still being created by the SDK.
 */
const bindExternalId = async (userId: string, attempts = 6): Promise<boolean> => {
  for (let i = 0; i < attempts; i++) {
    try {
      await OneSignal.login(userId);
      // Belt & braces: explicitly set the alias too (no-op if already set).
      try {
        await OneSignal.User.addAlias("external_id", userId);
      } catch {
        /* alias already present or unsupported build */
      }
      const current = OneSignal.User.externalId;
      if (current === userId) {
        console.info("[OneSignal] external_id bound", userId);
        return true;
      }
    } catch (err) {
      console.warn("[OneSignal] login attempt failed", err);
    }
    // Exponential-ish backoff: 0.5s, 1s, 2s, 3s, 4s, 5s
    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** i, 5000)));
  }
  console.warn("[OneSignal] external_id could not be confirmed for", userId);
  return false;
};

/** Login: bind the OneSignal external_id to the Supabase user id. */
export const loginOneSignal = async (userId: string) => {
  if (isUnsupportedEnv()) return;
  pendingUserId = userId;
  try {
    await initOneSignal();
    if (!initialized) return;
    attachListeners();
    await bindExternalId(userId);
  } catch (err) {
    console.warn("[OneSignal] login failed", err);
  }
};

export const logoutOneSignal = async () => {
  pendingUserId = null;
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
    if (perm !== true) {
      // Native browser prompt — works on iOS PWA (16.4+) and Android.
      await OneSignal.Notifications.requestPermission();
    }
    // Once permission is granted a subscription is created: (re)bind the id.
    if (pendingUserId) await bindExternalId(pendingUserId);
  } catch (err) {
    console.warn("[OneSignal] permission prompt failed", err);
  }
};

export interface OneSignalDiagnostics {
  supported: boolean;
  initialized: boolean;
  permission: boolean | null;
  optedIn: boolean | null;
  subscriptionId: string | null;
  onesignalId: string | null;
  externalId: string | null;
  expectedExternalId: string | null;
}

export const getOneSignalDiagnostics = async (): Promise<OneSignalDiagnostics> => {
  const base: OneSignalDiagnostics = {
    supported: !isUnsupportedEnv(),
    initialized,
    permission: null,
    optedIn: null,
    subscriptionId: null,
    onesignalId: null,
    externalId: null,
    expectedExternalId: pendingUserId,
  };
  if (!base.supported) return base;
  try {
    await initOneSignal();
    base.initialized = initialized;
    if (!initialized) return base;
    base.permission = OneSignal.Notifications.permission ?? null;
    base.optedIn = OneSignal.User.PushSubscription.optedIn ?? null;
    base.subscriptionId = OneSignal.User.PushSubscription.id ?? null;
    base.onesignalId = OneSignal.User.onesignalId ?? null;
    base.externalId = OneSignal.User.externalId ?? null;
  } catch (err) {
    console.warn("[OneSignal] diagnostics failed", err);
  }
  return base;
};

/** Force a re-bind of the external_id (used by the settings repair button). */
export const repairOneSignalBinding = async (userId: string) => {
  if (isUnsupportedEnv()) return false;
  pendingUserId = userId;
  await initOneSignal();
  if (!initialized) return false;
  if (OneSignal.Notifications.permission !== true) {
    await OneSignal.Notifications.requestPermission();
  }
  try {
    await OneSignal.User.PushSubscription.optIn();
  } catch {
    /* already opted in */
  }
  return bindExternalId(userId, 8);
};
