import { defineConfig } from "drizzle-kit";
import { configValidationSchema } from "./src/config/config.validation";

const config = configValidationSchema.parse(process.env);

export default defineConfig({
  schema: "./src/drizzle/schemas/index.ts",
  out: "./src/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: config.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
