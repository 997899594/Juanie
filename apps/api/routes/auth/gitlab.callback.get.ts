import { defineEventHandler, getQuery, getCookie } from "h3";
import { upsertOAuthAccount } from "../../src/auth/user";
import { createSession } from "../../src/auth/session";

export default defineEventHandler(async (event) => {
  const { code, state } = getQuery(event) as Record<string, string>;
  const saved = getCookie(event, "oauth_state");
  if (!code || !state || !saved || saved !== state)
    throw new Error("Invalid state");

  const tokenRes = await fetch("https://gitlab.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GITLAB_CLIENT_ID as string,
      client_secret: process.env.GITLAB_CLIENT_SECRET as string,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.GITLAB_REDIRECT_URI as string,
    }),
  });
  const token = await tokenRes.json();
  const userRes = await fetch("https://gitlab.com/api/v4/user", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await userRes.json();

  const { userId } = await upsertOAuthAccount(
    "gitlab",
    String(profile.id),
    profile
  );
  await createSession(event, userId);
  return { ok: true };
});
