import { defineEventHandler, getCookie, setCookie, setHeader } from "h3";
import { getNestApp } from "@/index";
import { SessionService } from "@/modules/auth/services/session.service";

export default defineEventHandler(async (event) => {
  const app = await getNestApp();
  const sessionService = app.get(SessionService);

  const sessionToken = getCookie(event, "session_token");

  if (sessionToken) {
    try {
      // 从 token 获取 session 信息并撤销
      const session = await sessionService.validateSession(sessionToken);
      if (session) {
        // 这里需要从 session token 获取 session ID
        // 你可能需要在 SessionService 中添加一个方法来获取 session ID
        // await sessionService.revokeSession(sessionId);
      }
    } catch (error) {
      // 忽略错误，继续清除 cookie
    }
  }

  // 清除会话 cookie
  setCookie(event, "session_token", "", {
    httpOnly: true,
    secure: true,
    maxAge: 0,
  });

  setHeader(event, "Content-Type", "application/json; charset=utf-8");
  return {
    success: true,
    message: "Session destroyed",
  };
});
