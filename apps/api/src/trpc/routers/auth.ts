import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { OAuthService } from "../../services/oauth.service";
import { db } from "../../db";

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

export const authRouter = router({
  /**
   * 获取GitHub授权URL
   */
  getGitHubAuthUrl: publicProcedure
    .input(
      z.object({
        redirectTo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { url, state } = await oauthService.createGitHubAuthUrl(input.redirectTo);
      return { url, state };
    }),

  /**
   * 获取GitLab授权URL
   */
  getGitLabAuthUrl: publicProcedure
    .input(
      z.object({
        redirectTo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { url, state } = await oauthService.createGitLabAuthUrl(input.redirectTo);
      return { url, state };
    }),

  /**
   * 验证会话并获取当前用户
   */
  getCurrentUser: publicProcedure
    .input(
      z.object({
        sessionToken: z.string(),
      })
    )
    .query(async ({ input }) => {
      const result = await oauthService.validateSession(input.sessionToken);
      
      if (!result) {
        throw new Error("Invalid session");
      }

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          image: result.user.image,
        },
        session: {
          id: result.session.id,
          expires: result.session.expires,
        },
      };
    }),

  /**
   * 登出
   */
  logout: publicProcedure
    .input(
      z.object({
        sessionToken: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await oauthService.deleteSession(input.sessionToken);
      return { success: true };
    }),
});