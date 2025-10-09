import { hash } from "@node-rs/argon2";
import { defineEventHandler, readBody } from "h3";
import { createSession } from "../../src/auth/session";
import { createUserWithEmail } from "../../src/auth/user";

export default defineEventHandler(async (event) => {
  const { email, password } = (await readBody(event)) as {
    email: string;
    password: string;
  };
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const { userId } = await createUserWithEmail(email, passwordHash);
  await createSession(event, userId);
  return { ok: true };
});
