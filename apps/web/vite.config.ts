import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
    conditions: mode === "development" ? ["development"] : ["default"],
  },
  optimizeDeps: {
    include: ["vue", "vue-router", "lucide-vue-next"],
    exclude: ["@juanie/ui", "@juanie/api"],
  },
  server: {
    port: 1997,
    host: true,
  },
  build: {
    target: "esnext", // 现代浏览器优化
    rollupOptions: {
      output: {
        manualChunks: {
          "vue-vendor": ["vue", "vue-router"],
          "ui-vendor": ["@juanie/ui", "lucide-vue-next"],
        },
      },
    },
  },
}));
