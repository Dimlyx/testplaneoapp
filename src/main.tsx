import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress the browser's PWA install banner ("Ouvrir dans l'appli")
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
