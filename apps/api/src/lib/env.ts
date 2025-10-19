import * as v from "valibot";

const envSchema = v.object({
  // 数据库
  DATABASE_URL: v.pipe(v.string(), v.url()),

  // 服务器
  PORT: v.fallback(v.pipe(v.string(), v.transform(Number), v.number()), 3001),
  HOSTNAME: v.fallback(v.string(), "localhost"),
  NODE_ENV: v.fallback(
    v.picklist(["development", "production", "test"]),
    "development"
  ),

  // CORS
  CORS_ORIGIN: v.optional(v.string()),
});

export const env = v.parse(envSchema, process.env);

export type Env = v.InferOutput<typeof envSchema>;
