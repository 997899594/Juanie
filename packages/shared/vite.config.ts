import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      name: "JuanieShared",
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: [],
    },
  },
});
