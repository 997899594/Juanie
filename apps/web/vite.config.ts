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
    conditions:
      mode === "development"
        ? ["development", "bun", "module", "default"]
        : ["default"],
  },
  optimizeDeps: {
    include: ["@juanie/ui", "vue", "vue-router", "lucide-vue-next"],
    // 移除不需要的依赖
    exclude: ["@juanie/api"],
  },
  server: {
    port: 5173,
    host: true,
    open: true, // 自动打开浏览器
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
