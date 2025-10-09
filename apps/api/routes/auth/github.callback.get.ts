import { defineEventHandler, getQuery, getCookie } from "h3";
import { upsertOAuthAccount } from "../../src/auth/user";
import { createSession } from "../../src/auth/session";

export default defineEventHandler(async (event) => {
  const { code, state } = getQuery(event) as Record<string, string>;
  const saved = getCookie(event, "oauth_state");
  if (!code || !state || !saved || saved !== state)
    throw new Error("Invalid state");

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    }),
  });
  const token = await tokenRes.json();
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await userRes.json();

  const { userId } = await upsertOAuthAccount(
    "github",
    String(profile.id),
    profile
  );
  await createSession(event, userId);
  return { ok: true };
});
