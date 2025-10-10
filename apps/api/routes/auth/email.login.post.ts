import { verify } from "@node-rs/argon2";
import { defineEventHandler, readBody } from "h3";
import { createSession } from "../../src/auth/session";
import { findUserByEmail } from "../../src/auth/user";

export default defineEventHandler(async (event) => {
  const { email, password } = (await readBody(event)) as {
    email: string;
    password: string;
  };
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Invalid credentials");
  const ok = await verify(user.passwordHash, password);
  if (!ok) throw new Error("Invalid credentials");
  await createSession(event, user.userId);
  return { ok: true };
});
