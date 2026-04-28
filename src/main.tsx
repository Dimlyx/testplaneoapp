import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress the browser's PWA install banner on desktop only (keep it for Median/mobile)
window.addEventListener('beforeinstallprompt', (e) => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) {
    e.preventDefault();
  }
});

// Mark the document as offline at boot so the AuthProvider / OfflineProvider
// can short-circuit any network call that would otherwise hang the WebView
// (Median sometimes lets the page load but kills outbound HTTP). The class
// is also useful for CSS escape hatches if needed.
const markOnlineState = () => {
  document.documentElement.classList.toggle('app-offline', !navigator.onLine);
};
markOnlineState();
window.addEventListener('online', markOnlineState);
window.addEventListener('offline', markOnlineState);

if (!navigator.onLine) {
  console.warn('[PLANEO] Boot in offline mode — skipping network-bound init.');
}

// Ultimate safety net: if React fails to mount within 8s (e.g. lazy chunk
// blocked by dead network), show a minimal offline message instead of a
// blank white screen.
const rootEl = document.getElementById("root")!;
const bootGuard = window.setTimeout(() => {
  if (!rootEl.hasChildNodes()) {
    rootEl.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#101727;color:#fff;text-align:center;">
        <div>
          <h1 style="font-size:20px;margin:0 0 12px;">PLANEO est hors-ligne</h1>
          <p style="opacity:.8;margin:0 0 16px;">Impossible de charger l'application. Vérifiez votre connexion puis relancez.</p>
          <button onclick="location.reload()" style="padding:10px 18px;border-radius:8px;border:0;background:#3b82f6;color:#fff;font-weight:600;">Réessayer</button>
        </div>
      </div>
    `;
  }
}, 8000);

try {
  createRoot(rootEl).render(<App />);
  // Clear guard once React commits its first render
  queueMicrotask(() => {
    if (rootEl.hasChildNodes()) window.clearTimeout(bootGuard);
  });
} catch (err) {
  console.error('[PLANEO] React mount failed', err);
}
