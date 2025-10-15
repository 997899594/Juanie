import {
  createError,
  defineEventHandler,
  getCookie,
  getQuery,
  sendRedirect,
  setCookie,
} from "h3";
import { AuthService } from "@/modules/auth/services/auth.service";
import { SessionService } from "@/modules/auth/services/session.service";
import { getNestApp } from "@/index";

export default defineEventHandler(async (event) => {
  const app = await getNestApp();
  const authService = app.get(AuthService);
  const sessionService = app.get(SessionService);

  const { code, state } = getQuery(event);
  const storedState = getCookie(event, "oauth_state");
  const codeVerifier = getCookie(event, "oauth_code_verifier");

  if (!code || !state || state !== storedState || !codeVerifier) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid OAuth callback",
    });
  }

  try {
    const user = await authService.validateGitHubCallback(
      code as string,
      codeVerifier
    );
    const { session } = await sessionService.createSession(
      user.id,
      event.node.req.headers["user-agent"],
      event.node.req.socket.remoteAddress
    );

    // 设置会话 cookie
    setCookie(event, "session_token", session.token, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60, // 7天
    });

    // 清除临时 cookie
    setCookie(event, "oauth_state", "", { maxAge: 0 });
    setCookie(event, "oauth_code_verifier", "", { maxAge: 0 });

    return sendRedirect(event, "/dashboard");
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Authentication failed",
    });
  }
});
