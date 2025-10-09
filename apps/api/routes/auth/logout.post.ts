import { defineEventHandler } from "h3";
import { destroySession } from "../../src/auth/session";

export default defineEventHandler(async (event) => {
  await destroySession(event);
  return { ok: true };
});