import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    dts({ rollupTypes: true, insertTypesEntry: true }),
  ],
  build: {
    lib: {
      name: "JuanieUI",
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => `[name].${format}.js`,
    },
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: "src/index.ts",
        demo: "src/demo.ts",
        styles: "src/styles.ts",
      },
      external: ["vue"],
    },
  },
});
