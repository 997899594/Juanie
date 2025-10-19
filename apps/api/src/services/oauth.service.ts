import { GitHub, GitLab } from "arctic";
import { generateRandomString, alphabet } from "oslo/crypto";
import { sha256 } from "oslo/crypto";
import { encodeBase64url } from "oslo/encoding";
import type { Database } from "../db";
import { users, accounts, sessions } from "../db/schema";
import { eq, and } from "drizzle-orm";

// 扩展全局类型以支持OAuth状态存储
declare global {
  var oauthStates: Map<string, OAuthState> | undefined;
}

export interface OAuthConfig {
  github: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  gitlab: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    baseUrl?: string;
  };
}

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

export class OAuthService {
  private github?: GitHub;
  private gitlab?: GitLab;

  constructor(
    private db: Database,
    private config: OAuthConfig
  ) {
    // 初始化GitHub OAuth客户端
    if (config.github.clientId && config.github.clientSecret) {
      this.github = new GitHub(
        config.github.clientId,
        config.github.clientSecret,
        config.github.redirectUri
      );
    }

    // 初始化GitLab OAuth客户端
    if (config.gitlab.clientId && config.gitlab.clientSecret) {
      this.gitlab = new GitLab(
        config.gitlab.clientId,
        config.gitlab.clientSecret,
        config.gitlab.redirectUri,
        config.gitlab.baseUrl || "https://gitlab.com"
      );
    }
  }

  /**
   * 生成PKCE参数
   */
  private async generatePKCE() {
    const codeVerifier = generateRandomString(128, alphabet("a-z", "A-Z", "0-9", "-", "_"));
    const codeChallenge = encodeBase64url(await sha256(new TextEncoder().encode(codeVerifier)));
    return { codeVerifier, codeChallenge };
  }

  /**
   * 创建GitHub授权URL
   */
  async createGitHubAuthUrl(redirectTo?: string): Promise<{ url: string; state: string }> {
    if (!this.github) {
      throw new Error("GitHub OAuth not configured");
    }

    const state = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
    const { codeVerifier, codeChallenge } = await this.generatePKCE();
    
    // 存储状态信息（实际应用中应该存储到Redis或数据库）
    const oauthState: OAuthState = {
      provider: "github",
      codeVerifier,
      state,
      redirectTo,
    };

    // 这里简化处理，实际应该存储到缓存中
    globalThis.oauthStates = globalThis.oauthStates || new Map();
    globalThis.oauthStates.set(state, oauthState);

    const url = this.github.createAuthorizationURL(state, ["user:email"]);

    return { url: url.toString(), state };
  }

  /**
   * 创建GitLab授权URL
   */
  async createGitLabAuthUrl(redirectTo?: string): Promise<{ url: string; state: string }> {
    if (!this.gitlab) {
      throw new Error("GitLab OAuth not configured");
    }

    const state = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
    const { codeVerifier, codeChallenge } = await this.generatePKCE();
    
    const oauthState: OAuthState = {
      provider: "gitlab",
      codeVerifier,
      state,
      redirectTo,
    };

    globalThis.oauthStates = globalThis.oauthStates || new Map();
    globalThis.oauthStates.set(state, oauthState);

    const url = this.gitlab.createAuthorizationURL(state, ["read_user"]);

    return { url: url.toString(), state };
  }

  /**
   * 处理GitHub OAuth回调
   */
  async handleGitHubCallback(code: string, state: string): Promise<{ user: any; sessionId: string }> {
    if (!this.github) {
      throw new Error("GitHub OAuth not configured");
    }

    // 验证状态
    globalThis.oauthStates = globalThis.oauthStates || new Map();
    const oauthState = globalThis.oauthStates.get(state) as OAuthState;
    if (!oauthState || oauthState.provider !== "github") {
      throw new Error("Invalid OAuth state");
    }

    try {
      // 交换访问令牌
      const tokens = await this.github.validateAuthorizationCode(code);

      // 获取用户信息
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
          "User-Agent": "Juanie-App",
        },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch GitHub user");
      }

      const githubUser = await userResponse.json() as GitHubUser;

      // 获取用户邮箱（如果公开）
      let email = githubUser.email;
      if (!email) {
        const emailResponse = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${tokens.accessToken()}`,
            "User-Agent": "Juanie-App",
          },
        });

        if (emailResponse.ok) {
          const emails = await emailResponse.json() as Array<{ email: string; primary: boolean }>;
          const primaryEmail = emails.find((e) => e.primary);
          email = primaryEmail?.email || emails[0]?.email || null;
        }
      }

      // 创建或更新用户
      const user = await this.upsertUser({
        provider: "github",
        providerId: githubUser.id.toString(),
        email: email || `${githubUser.login}@github.local`,
        name: githubUser.name || githubUser.login,
        image: githubUser.avatar_url,
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken() || undefined,
      });

      if (!user) {
        throw new Error("Failed to create or update user");
      }

      // 创建会话
      const sessionId = await this.createSession(user.id);

      // 清理状态
      globalThis.oauthStates?.delete(state);

      return { user, sessionId };
    } catch (error) {
      globalThis.oauthStates?.delete(state);
      throw error;
    }
  }

  /**
   * 处理GitLab OAuth回调
   */
  async handleGitLabCallback(code: string, state: string): Promise<{ user: any; sessionId: string }> {
    if (!this.gitlab) {
      throw new Error("GitLab OAuth not configured");
    }

    globalThis.oauthStates = globalThis.oauthStates || new Map();
    const oauthState = globalThis.oauthStates.get(state) as OAuthState;
    if (!oauthState || oauthState.provider !== "gitlab") {
      throw new Error("Invalid OAuth state");
    }

    try {
      const tokens = await this.gitlab.validateAuthorizationCode(code);

      const baseUrl = this.config.gitlab.baseUrl || "https://gitlab.com";
      const userResponse = await fetch(`${baseUrl}/api/v4/user`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch GitLab user");
      }

      const gitlabUser = await userResponse.json() as GitLabUser;

      const user = await this.upsertUser({
        provider: "gitlab",
        providerId: gitlabUser.id.toString(),
        email: gitlabUser.email,
        name: gitlabUser.name,
        image: gitlabUser.avatar_url,
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken() || undefined,
      });

      if (!user) {
        throw new Error("Failed to create or update user");
      }

      const sessionId = await this.createSession(user.id);

      globalThis.oauthStates?.delete(state);

      return { user, sessionId };
    } catch (error) {
      globalThis.oauthStates?.delete(state);
      throw error;
    }
  }

  /**
   * 创建或更新用户
   */
  private async upsertUser(data: {
    provider: string;
    providerId: string;
    email: string;
    name: string;
    image?: string;
    accessToken: string;
    refreshToken?: string;
  }) {
    // 查找现有账户
    const [existingAccount] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.provider, data.provider),
          eq(accounts.providerAccountId, data.providerId)
        )
      )
      .limit(1);

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

      // 获取用户信息
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, existingAccount.userId))
        .limit(1);

      return user;
    }

    // 查找现有用户（通过邮箱）
    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
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

      if (!newUser) {
        throw new Error("Failed to create user");
      }

      userId = newUser.id;
    }

    // 创建账户关联
    await this.db.insert(accounts).values({
      userId,
      type: "oauth",
      provider: data.provider,
      providerAccountId: data.providerId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });

    // 返回用户信息
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user;
  }

  /**
   * 创建会话
   */
  private async createSession(userId: string): Promise<string> {
    const sessionToken = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天

    await this.db.insert(sessions).values({
      sessionToken,
      userId,
      expires,
    });

    return sessionToken;
  }

  /**
   * 验证会话
   */
  async validateSession(sessionToken: string) {
    const [session] = await this.db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);

    if (!session || session.session.expires < new Date()) {
      return null;
    }

    return {
      user: session.user,
      session: session.session,
    };
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionToken: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
  }
}