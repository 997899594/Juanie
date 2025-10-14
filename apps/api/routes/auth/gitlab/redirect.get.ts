import { defineEventHandler, sendRedirect, setCookie } from "h3";
import { AuthService } from "@/modules/auth/services/auth.service";
import { getNestApp } from "@/nest";

export default defineEventHandler(async (event) => {
  const app = await getNestApp();
  const authService = app.get(AuthService);

  const { url, state, codeVerifier } =
    await authService.createGitLabAuthorizationURL();

  // 存储 state 和 codeVerifier 到 cookie
  setCookie(event, "oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 600, // 10分钟
  });
  setCookie(event, "oauth_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: true,
    maxAge: 600,
  });

  return sendRedirect(event, url.toString());
});
