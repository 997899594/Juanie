import { defineEventHandler, getCookie, getQuery } from "h3";
import { createSession } from "../../src/auth/session";
import { upsertOAuthAccount } from "../../src/auth/user";

export default defineEventHandler(async (event) => {
  const { code, state } = getQuery(event) as Record<string, string>;
  const saved = getCookie(event, "oauth_state");
  if (!code || !state || !saved || saved !== state)
    throw new Error("Invalid state");

  const tokenRes = await fetch(
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}&code=${code}&grant_type=authorization_code`
  );
  const rawToken = await tokenRes.json();
  const accessToken =
    typeof (rawToken as any)?.access_token === "string"
      ? (rawToken as any).access_token
      : (() => {
          throw new Error("Invalid token response");
        })();
  const openid =
    typeof (rawToken as any)?.openid === "string"
      ? (rawToken as any).openid
      : (() => {
          throw new Error("Invalid token response: missing openid");
        })();

  const userRes = await fetch(
    `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}`
  );
  const rawProfile = await userRes.json();
  const profileOpenId = (rawProfile as any)?.openid;
  if (typeof profileOpenId !== "string") {
    throw new Error("Invalid profile response");
  }
  const profile = rawProfile as Record<string, unknown>;

  const { userId } = await upsertOAuthAccount(
    "wechat",
    String(profileOpenId),
    profile
  );
  await createSession(event, userId);
  return { ok: true };
});
