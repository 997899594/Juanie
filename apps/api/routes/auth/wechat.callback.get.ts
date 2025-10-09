import { defineEventHandler, getQuery, getCookie } from "h3";
import { upsertOAuthAccount } from "../../src/auth/user";
import { createSession } from "../../src/auth/session";

export default defineEventHandler(async (event) => {
  const { code, state } = getQuery(event) as Record<string, string>;
  const saved = getCookie(event, "oauth_state");
  if (!code || !state || !saved || saved !== state)
    throw new Error("Invalid state");

  const tokenRes = await fetch(
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}&code=${code}&grant_type=authorization_code`
  );
  const token = await tokenRes.json();
  const userRes = await fetch(
    `https://api.weixin.qq.com/sns/userinfo?access_token=${token.access_token}&openid=${token.openid}`
  );
  const profile = await userRes.json();

  const { userId } = await upsertOAuthAccount(
    "wechat",
    String(profile.openid),
    profile
  );
  await createSession(event, userId);
  return { ok: true };
});
