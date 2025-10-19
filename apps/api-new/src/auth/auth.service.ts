import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GitHub, GitLab } from "arctic";
import { and, eq } from "drizzle-orm";
import { alphabet, generateRandomString, sha256 } from "oslo/crypto";
import { encodeBase64url } from "oslo/encoding";
import { PG_CONNECTION } from "../db/drizzle.provider";
import type { SelectSession, SelectUser } from "../db/schema";
import { accounts, sessions, users } from "../db/schema";

export interface OAuthState {
  provider: "github" | "gitlab";
  codeVerifier: string;
  state: string;
  redirectTo?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url: string;
}

// 全局状态存储
declare global {
  var oauthStates: Map<string, OAuthState> | undefined;
}

@Injectable()
export class AuthService {
  private github?: GitHub;
  private gitlab?: GitLab;

  constructor(
    @Inject(PG_CONNECTION) private readonly db: any,
    private readonly configService: ConfigService
  ) {
    this.initializeOAuthProviders();
  }

  private initializeOAuthProviders() {
    const githubClientId = this.configService.get<string>("GITHUB_CLIENT_ID");
    const githubClientSecret = this.configService.get<string>(
      "GITHUB_CLIENT_SECRET"
    );
    const githubRedirectUri =
      this.configService.get<string>("GITHUB_REDIRECT_URI") ||
      "http://localhost:3000/auth/github/callback";

    const gitlabClientId = this.configService.get<string>("GITLAB_CLIENT_ID");
    const gitlabClientSecret = this.configService.get<string>(
      "GITLAB_CLIENT_SECRET"
    );
    const gitlabRedirectUri =
      this.configService.get<string>("GITLAB_REDIRECT_URI") ||
      "http://localhost:3000/auth/gitlab/callback";
    const gitlabBaseUrl =
      this.configService.get<string>("GITLAB_BASE_URL") || "https://gitlab.com";

    if (githubClientId && githubClientSecret) {
      this.github = new GitHub(
        githubClientId,
        githubClientSecret,
        githubRedirectUri
      );
    }

    if (gitlabClientId && gitlabClientSecret) {
      this.gitlab = new GitLab(
        gitlabBaseUrl,
        gitlabClientId,
        gitlabClientSecret,
        gitlabRedirectUri
      );
    }
  }

  async createGitHubAuthUrl(
    redirectTo?: string
  ): Promise<{ url: string; state: string }> {
    if (!this.github) {
      throw new Error("GitHub OAuth not configured");
    }

    const state = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
    const codeVerifier = generateRandomString(
      128,
      alphabet("a-z", "A-Z", "0-9", "-", "_")
    );

    const url = await this.github.createAuthorizationURL(state, ["user:email"]);

    // 存储状态
    globalThis.oauthStates = globalThis.oauthStates || new Map();
    globalThis.oauthStates.set(state, {
      provider: "github",
      codeVerifier,
      state,
      redirectTo,
    });

    return { url: url.toString(), state };
  }

  async createGitLabAuthUrl(
    redirectTo?: string
  ): Promise<{ url: string; state: string }> {
    if (!this.gitlab) {
      throw new Error("GitLab OAuth not configured");
    }

    const state = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
    const codeVerifier = generateRandomString(
      128,
      alphabet("a-z", "A-Z", "0-9", "-", "_")
    );

    const url = await this.gitlab.createAuthorizationURL(state, ["read_user"]);

    globalThis.oauthStates = globalThis.oauthStates || new Map();
    globalThis.oauthStates.set(state, {
      provider: "gitlab",
      codeVerifier,
      state,
      redirectTo,
    });

    return { url: url.toString(), state };
  }

  async handleGitHubCallback(
    code: string,
    state: string
  ): Promise<{ user: SelectUser; sessionId: string; redirectTo?: string }> {
    if (!this.github) {
      throw new Error("GitHub OAuth not configured");
    }

    globalThis.oauthStates = globalThis.oauthStates || new Map();
    const oauthState = globalThis.oauthStates.get(state);
    if (!oauthState || oauthState.provider !== "github") {
      throw new Error("Invalid OAuth state");
    }

    try {
      const tokens = await this.github.validateAuthorizationCode(code);

      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
          "User-Agent": "Juanie-App",
        },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch GitHub user");
      }

      const githubUser = (await userResponse.json()) as GitHubUser;

      let email = githubUser.email;
      if (!email) {
        const emailResponse = await fetch(
          "https://api.github.com/user/emails",
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken()}`,
              "User-Agent": "Juanie-App",
            },
          }
        );

        if (emailResponse.ok) {
          const emails = (await emailResponse.json()) as Array<{
            email: string;
            primary: boolean;
          }>;
          const primaryEmail = emails.find((e) => e.primary);
          email = primaryEmail?.email || emails[0]?.email || null;
        }
      }

      const user = await this.upsertUser({
        provider: "github",
        providerId: githubUser.id.toString(),
        email: email || `${githubUser.login}@github.local`,
        name: githubUser.name || githubUser.login,
        image: githubUser.avatar_url,
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken() || undefined,
      });

      const sessionId = await this.createSession(user.id);
      const redirectTo = oauthState.redirectTo;

      globalThis.oauthStates?.delete(state);

      return { user, sessionId, redirectTo };
    } catch (error) {
      globalThis.oauthStates?.delete(state);
      throw error;
    }
  }

  async handleGitLabCallback(
    code: string,
    state: string
  ): Promise<{ user: SelectUser; sessionId: string; redirectTo?: string }> {
    if (!this.gitlab) {
      throw new Error("GitLab OAuth not configured");
    }

    globalThis.oauthStates = globalThis.oauthStates || new Map();
    const oauthState = globalThis.oauthStates.get(state);
    if (!oauthState || oauthState.provider !== "gitlab") {
      throw new Error("Invalid OAuth state");
    }

    try {
      const tokens = await this.gitlab.validateAuthorizationCode(code);

      const baseUrl =
        this.configService.get<string>("GITLAB_BASE_URL") ||
        "https://gitlab.com";
      const userResponse = await fetch(`${baseUrl}/api/v4/user`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch GitLab user");
      }

      const gitlabUser = (await userResponse.json()) as GitLabUser;

      const user = await this.upsertUser({
        provider: "gitlab",
        providerId: gitlabUser.id.toString(),
        email: gitlabUser.email,
        name: gitlabUser.name,
        image: gitlabUser.avatar_url,
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken() || undefined,
      });

      const sessionId = await this.createSession(user.id);
      const redirectTo = oauthState.redirectTo;

      globalThis.oauthStates?.delete(state);

      return { user, sessionId, redirectTo };
    } catch (error) {
      globalThis.oauthStates?.delete(state);
      throw error;
    }
  }

  private async upsertUser(data: {
    provider: string;
    providerId: string;
    email: string;
    name: string;
    image?: string;
    accessToken: string;
    refreshToken?: string;
  }): Promise<SelectUser> {
    // 查找现有账户
    const [existingAccount] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.provider, data.provider),
          eq(accounts.providerId, data.providerId)
        )
      );

    if (existingAccount) {
      // 更新现有账户的令牌
      await this.db
        .update(accounts)
        .set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, existingAccount.id));

      // 同时更新用户信息（同步 GitLab 上的最新信息）
      const [updatedUser] = await this.db
        .update(users)
        .set({
          name: data.name,
          email: data.email,
          image: data.image,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingAccount.userId))
        .returning();

      return updatedUser;
    }

    // 查找现有用户（通过邮箱）
    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, data.email));

    let user: SelectUser;

    if (existingUser) {
      // 更新现有用户信息（同步 GitLab 上的最新信息）
      const [updatedUser] = await this.db
        .update(users)
        .set({
          name: data.name,
          email: data.email,
          image: data.image,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      user = updatedUser;
    } else {
      // 创建新用户
      const [newUser] = await this.db
        .insert(users)
        .values({
          email: data.email,
          name: data.name,
          image: data.image,
        })
        .returning();

      user = newUser;
    }

    // 创建新账户
    await this.db.insert(accounts).values({
      userId: user.id,
      provider: data.provider,
      providerId: data.providerId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });

    return user;
  }

  async createSession(userId: number): Promise<string> {
    const sessionId = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天

    await this.db.insert(sessions).values({
      id: sessionId,
      userId,
      expires,
    });

    return sessionId;
  }

  async validateSession(
    sessionId: string
  ): Promise<{ user: SelectUser; session: SelectSession } | null> {
    console.log("=== validateSession 调试信息 ===");
    console.log("输入的 sessionId:", sessionId);

    try {
      const [result] = await this.db
        .select({
          user: users,
          session: sessions,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, sessionId));

      console.log("数据库查询结果:", result);

      if (!result) {
        console.log("未找到对应的会话记录");
        return null;
      }

      console.log("会话过期时间:", result.session.expires);
      console.log("当前时间:", new Date());
      console.log("会话是否过期:", result.session.expires < new Date());

      if (result.session.expires < new Date()) {
        console.log("会话已过期，删除会话");
        await this.deleteSession(sessionId);
        return null;
      }

      console.log("会话验证成功，返回用户信息");
      return result;
    } catch (error) {
      console.error("validateSession 数据库查询错误:", error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }
}
