import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
export default defineConfig({
  plugins: [dts({ rollupTypes: true, insertTypesEntry: true })],
  build: {
    lib: {
      name: "JuanieUI",
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["vue"],
    },
  },
});
