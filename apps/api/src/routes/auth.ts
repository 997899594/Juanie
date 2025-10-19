import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { OAuthService } from "../services/oauth.service";
import { db } from "../db";

const app = new Hono();

// OAuth配置
const oauthConfig = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    redirectUri: process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/auth/github/callback",
  },
  gitlab: {
    clientId: process.env.GITLAB_CLIENT_ID || "",
    clientSecret: process.env.GITLAB_CLIENT_SECRET || "",
    redirectUri: process.env.GITLAB_REDIRECT_URI || "http://localhost:3000/auth/gitlab/callback",
    baseUrl: process.env.GITLAB_BASE_URL,
  },
};

const oauthService = new OAuthService(db, oauthConfig);

/**
 * GitHub登录 - 重定向到GitHub授权页面
 */
app.get("/github", async (c) => {
  try {
    const redirectTo = c.req.query("redirect_to");
    const { url, state } = await oauthService.createGitHubAuthUrl(redirectTo);
    
    // 将state存储到cookie中作为额外验证
    setCookie(c, "oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10分钟
    });

    return c.redirect(url);
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    return c.json({ error: "Failed to initiate GitHub OAuth" }, 500);
  }
});

/**
 * GitHub OAuth回调处理
 */
app.get("/github/callback", async (c) => {
  try {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const cookieState = getCookie(c, "oauth_state");

    if (!code || !state) {
      return c.json({ error: "Missing authorization code or state" }, 400);
    }

    // 验证state参数
    if (state !== cookieState) {
      return c.json({ error: "Invalid state parameter" }, 400);
    }

    // 清理state cookie
    deleteCookie(c, "oauth_state");

    const { user, sessionId } = await oauthService.handleGitHubCallback(code, state);

    // 设置会话cookie
    setCookie(c, "session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30天
    });

    // 重定向到前端应用
    const redirectTo = c.req.query("redirect_to") || "/dashboard";
    return c.redirect(redirectTo);
  } catch (error) {
    console.error("GitHub callback error:", error);
    return c.json({ error: "GitHub authentication failed" }, 500);
  }
});

/**
 * GitLab登录 - 重定向到GitLab授权页面
 */
app.get("/gitlab", async (c) => {
  try {
    const redirectTo = c.req.query("redirect_to");
    const { url, state } = await oauthService.createGitLabAuthUrl(redirectTo);
    
    setCookie(c, "oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
    });

    return c.redirect(url);
  } catch (error) {
    console.error("GitLab OAuth error:", error);
    return c.json({ error: "Failed to initiate GitLab OAuth" }, 500);
  }
});

/**
 * GitLab OAuth回调处理
 */
app.get("/gitlab/callback", async (c) => {
  try {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const cookieState = getCookie(c, "oauth_state");

    if (!code || !state) {
      return c.json({ error: "Missing authorization code or state" }, 400);
    }

    if (state !== cookieState) {
      return c.json({ error: "Invalid state parameter" }, 400);
    }

    deleteCookie(c, "oauth_state");

    const { user, sessionId } = await oauthService.handleGitLabCallback(code, state);

    setCookie(c, "session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    });

    const redirectTo = c.req.query("redirect_to") || "/dashboard";
    return c.redirect(redirectTo);
  } catch (error) {
    console.error("GitLab callback error:", error);
    return c.json({ error: "GitLab authentication failed" }, 500);
  }
});

/**
 * 登出
 */
app.post("/logout", async (c) => {
  try {
    const sessionToken = getCookie(c, "session");
    
    if (sessionToken) {
      await oauthService.deleteSession(sessionToken);
      deleteCookie(c, "session");
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json({ error: "Logout failed" }, 500);
  }
});

/**
 * 获取当前用户信息
 */
app.get("/me", async (c) => {
  try {
    const sessionToken = getCookie(c, "session");
    
    if (!sessionToken) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const result = await oauthService.validateSession(sessionToken);
    
    if (!result) {
      deleteCookie(c, "session");
      return c.json({ error: "Invalid session" }, 401);
    }

    return c.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return c.json({ error: "Failed to get user info" }, 500);
  }
});

export default app;