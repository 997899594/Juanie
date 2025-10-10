import { randomUUID } from "node:crypto";
import { defineEventHandler, sendRedirect, setCookie } from "h3";

export default defineEventHandler(async (event) => {
  const state = randomUUID();
  setCookie(event, "oauth_state", state, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
  const url = new URL("https://gitlab.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITLAB_CLIENT_ID as string);
  url.searchParams.set(
    "redirect_uri",
    process.env.GITLAB_REDIRECT_URI as string
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "read_user");
  url.searchParams.set("state", state);
  return sendRedirect(event, url.toString(), 302);
});
