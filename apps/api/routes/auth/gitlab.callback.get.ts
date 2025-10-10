import { defineEventHandler, getCookie, getQuery } from "h3";
import { createSession } from "../../src/auth/session";
import { upsertOAuthAccount } from "../../src/auth/user";

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
  const rawToken = await tokenRes.json();
  const accessToken =
    typeof (rawToken as any)?.access_token === "string"
      ? (rawToken as any).access_token
      : (() => {
          throw new Error("Invalid token response");
        })();

  const userRes = await fetch("https://gitlab.com/api/v4/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const rawProfile = await userRes.json();
  const profileId = (rawProfile as any)?.id;
  if (typeof profileId !== "string" && typeof profileId !== "number") {
    throw new Error("Invalid profile response");
  }
  const profile = rawProfile as Record<string, unknown>;

  const { userId } = await upsertOAuthAccount(
    "gitlab",
    String(profileId),
    profile
  );
  await createSession(event, userId);
  return { ok: true };
});
