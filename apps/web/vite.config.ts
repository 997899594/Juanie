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
    // 确保 UI 库与应用使用同一份 Vue 实例，避免运行时冲突
    dedupe: ["vue"],
    conditions: mode === "development" ? ["development"] : ["default"],
  },
  optimizeDeps: {
    include: ["vue", "vue-router", "lucide-vue-next"],
    exclude: ["@juanie/ui", "@juanie/api"],
  },
  define: {
    // 跳过 @juanie/api 包的类型检查
    __SKIP_API_TYPE_CHECK__: true,
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
