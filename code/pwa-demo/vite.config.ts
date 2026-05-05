import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "PWA demo",
        short_name: "PWA",
        start_url: "/",
        display: "standalone",
        background_color: "#0c0f14",
        theme_color: "#2e7df6",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:woff2?|ttf)$/,
            handler: "CacheFirst",
            options: { cacheName: "fonts", expiration: { maxEntries: 10, maxAgeSeconds: 30 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
});
