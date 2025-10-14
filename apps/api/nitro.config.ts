import { defineNitroConfig } from "nitropack/config";
import { resolve } from "path";

export default defineNitroConfig({
  srcDir: ".",
  compatibilityDate: "2025-01-14",
  alias: {
    "@": resolve(__dirname, "./src"),
  },
  routeRules: {
    "/api/trpc/**": { cors: true },
  },
  storage: {
    redis: { driver: "redis" },
  },
  plugins: ["~/plugins/otel.ts"],
});
