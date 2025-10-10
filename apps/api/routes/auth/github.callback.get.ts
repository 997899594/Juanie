import { defineEventHandler, getCookie, getQuery } from "h3";
import { createSession } from "../../src/auth/session";
import { upsertOAuthAccount } from "../../src/auth/user";

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
  const rawToken = await tokenRes.json();
  const accessToken =
    typeof (rawToken as any)?.access_token === "string"
      ? (rawToken as any).access_token
      : (() => {
          throw new Error("Invalid token response");
        })();

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const rawProfile = await userRes.json();
  const profileId = (rawProfile as any)?.id;
  if (typeof profileId !== "string" && typeof profileId !== "number") {
    throw new Error("Invalid profile response");
  }
  const profile = rawProfile as Record<string, unknown>;

  const { userId } = await upsertOAuthAccount(
    "github",
    String(profileId),
    profile
  );
  await createSession(event, userId);
  return { ok: true };
});
