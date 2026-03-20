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

createRoot(document.getElementById("root")!).render(<App />);
