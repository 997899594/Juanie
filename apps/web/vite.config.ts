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
    exclude: ["@juanie/ui", "@juanie/ui/styles", "@juanie/ui/demo"],
    include: [
      "vue",
      "vue-router",
      "pinia",
      "@vueuse/core",
      "echarts",
      "lodash-es",
      "dayjs",
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vue-vendor": ["vue", "vue-router", "pinia"],
          "ui-vendor": ["@juanie/ui"],
          "utils-vendor": ["@vueuse/core", "lodash-es", "dayjs"],
          "charts-vendor": ["echarts"],
        },
      },
    },
  },
}));
