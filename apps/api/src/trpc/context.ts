import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { Context as HonoContext } from "hono";
import { type Database, db } from "../db";

export interface Context {
  db: Database;
  req: Request;
  headers: Record<string, string>;
  user: null | { id: string; email: string }; // 后续添加认证
}

export function createContext(opts: FetchCreateContextFnOptions, c: HonoContext): Record<string, unknown> {
  // 获取所有 headers
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value: string, key: string | number) => {
    headers[key] = value;
  });

  return {
    db,
    req: c.req.raw,
    headers,
    user: null, // 后续从 JWT 或 session 中获取
  };
}
