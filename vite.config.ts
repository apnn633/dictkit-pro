import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";

// Vite config for dictkit-pro — a TypeScript rewrite of the static dictkit-unified.
// - base: "./" so the build can be deployed to any sub-path (GitHub Pages project pages included)
// - dev server proxies /data to the symlinked dictkit-unified data so search/images resolve in dev
// - PWA: offline shell + runtime image cache via workbox
export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    assetsInlineLimit: 0, // keep woff2 fonts and images as separate files
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split heavy search data / viewer logic out of the main entry chunk
        manualChunks: {
          search: ["@/search/engine", "@/search/pinyin", "@/search/highlight"],
          viewer: ["@/viewer/viewer", "@/viewer/zoom", "@/viewer/touch"],
          core: ["@/core/state", "@/core/config", "@/core/data-loader", "@/core/image-loader", "@/core/navigation"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // data 是指向词典图片库的符号链接，含上万张 PNG；排除以免耗尽 inotify 配额
      ignored: [/data/, /node_modules/, /\.git/],
    },
  },
  preview: {
    port: 8765,
    host: true,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "assets/logos/logo2.png"],
      manifest: {
        name: "汉语字典词典在线版",
        short_name: "字典词典",
        description: "汉语字典词典在线检索，支持拼音、字词、页码查询",
        theme_color: "#ec0015",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "assets/logos/logo-192.png", sizes: "192x192", type: "image/png" },
          { src: "assets/logos/logo-512.png", sizes: "512x512", type: "image/png" },
          { src: "assets/logos/logo-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ico}"],
        // Cache dictionary images at runtime so previously viewed pages work offline
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|webp|svg)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "dictkit-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /data\/.*\.json$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "dictkit-metadata",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
