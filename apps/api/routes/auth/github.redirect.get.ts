import { defineEventHandler, setCookie, sendRedirect } from "h3";
import { randomUUID } from "node:crypto";

export default defineEventHandler(async (event) => {
  const state = randomUUID();
  setCookie(event, "oauth_state", state, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID as string);
  url.searchParams.set(
    "redirect_uri",
    process.env.GITHUB_REDIRECT_URI as string
  );
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return sendRedirect(event, url.toString(), 302);
});
