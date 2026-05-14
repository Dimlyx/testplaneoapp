import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      strategies: "generateSW",
      filename: "sw.js",
      includeAssets: ["favicon.png", "placeholder.svg"],
      manifest: {
        id: "tech.planeo.app",
        name: "PLANEO",
        short_name: "PLANEO",
        description: "Application de gestion des interventions SAV",
        theme_color: "#1e3a5f",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "fr",
        dir: "ltr",
        categories: ["business", "productivity", "utilities"],
        icons: [
          {
            src: "/favicon.png",
            sizes: "64x64",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "/screenshots/screen1.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "Écran de connexion PLANEO",
          },
          {
            src: "/screenshots/screen2.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "Liste des interventions",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        // Do not let the Workbox SW intercept OneSignal's worker scope.
        globIgnores: ["**/push/onesignal/**"],
        navigateFallbackDenylist: [/^\/push\/onesignal\//, /^\/sw\.js$/, /^\/workbox-.*\.js$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/gwqjwclvrihumhqzoikv\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 3,
              expiration: {
                // Bumped to fit a full day of pre-cached active interventions
                // (~5 endpoints per intervention × dozens of interventions).
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/gwqjwclvrihumhqzoikv\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
