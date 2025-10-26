import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { eq, and, or, desc, count, inArray, lt, isNotNull } from 'drizzle-orm';
import {
  oauthAccounts,
  OAuthAccount,
  NewOAuthAccount,
  insertOAuthAccountSchema,
  selectOAuthAccountSchema
} from '../../database/schemas/oauth-accounts.schema';
import { users, User } from '../../database/schemas/users.schema';

export type OauthProvider = 'github' | 'gitlab';

export interface OauthAccountInfo {
  id: string;
  provider: OauthProvider;
  providerAccountId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  profileUrl?: string;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface OauthAccountStats {
  totalAccounts: number;
  activeAccounts: number;
  githubAccounts: number;
  gitlabAccounts: number;
}

export interface GitHubUserData {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  html_url?: string;
  company?: string;
  location?: string;
  bio?: string;
  public_repos?: number;
  followers?: number;
  following?: number;
}

export interface GitLabUserData {
  id: number;
  username: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  web_url?: string;
  state?: string;
  created_at?: string;
  bio?: string;
  public_email?: string;
}

@Injectable()
export class OAuthAccountsService {
  private readonly logger = new Logger(OAuthAccountsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * Hello method for testing
   */
  hello(): string {
    return 'Hello from OAuth Accounts Service';
  }

  /**
   * 创建或更新OAuth账户
   */
  async createOrUpdateOauthAccount(
    userId: string,
    provider: OauthProvider,
    providerAccountId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
    scope?: string,
    tokenType: string = 'Bearer',
    userData?: GitHubUserData | GitLabUserData
  ): Promise<OAuthAccount> {
    try {
      // 检查是否已存在该OAuth账户
      const [existingAccount] = await this.db
        .select()
        .from(oauthAccounts)
        .where(and(
          eq(oauthAccounts.userId, userId),
          eq(oauthAccounts.provider, provider),
          eq(oauthAccounts.providerAccountId, providerAccountId)
        ))
        .limit(1);

      const accountData: Partial<NewOAuthAccount> = {
        userId,
        provider,
        providerAccountId,
        accessToken,
        refreshToken,
        tokenType,
        scope,
        expiresAt,
        lastUsedAt: new Date(),
      };

      // 根据提供商设置特定数据
      if (provider === 'github' && userData) {
        accountData.githubData = userData as GitHubUserData;
      } else if (provider === 'gitlab' && userData) {
        accountData.gitlabData = userData as GitLabUserData;
      }

      if (existingAccount) {
        // 更新现有账户
        const [updatedAccount] = await this.db
          .update(oauthAccounts)
          .set({
            ...accountData,
            updatedAt: new Date(),
          })
          .where(eq(oauthAccounts.id, existingAccount.id))
          .returning();

        this.logger.log(`OAuth account updated: ${provider}:${providerAccountId} for user: ${userId}`);
        return updatedAccount;
      } else {
        // 创建新账户
        const [newAccount] = await this.db
          .insert(oauthAccounts)
          .values(accountData as NewOAuthAccount)
          .returning();

        this.logger.log(`OAuth account created: ${provider}:${providerAccountId} for user: ${userId}`);
        return newAccount;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create/update OAuth account: ${errorMessage}`);
      throw new BadRequestException('Failed to create or update OAuth account');
    }
  }

  /**
   * 根据用户ID和提供商查找OAuth账户
   */
  async findByUserAndProvider(userId: string, provider: OauthProvider): Promise<OAuthAccount | null> {
    try {
      const [account] = await this.db
        .select()
        .from(oauthAccounts)
        .where(and(
          eq(oauthAccounts.userId, userId),
          eq(oauthAccounts.provider, provider)
        ))
        .limit(1);

      return account || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find OAuth account: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 根据提供商和提供商账户ID查找OAuth账户
   */
  async findByProviderAccount(provider: OauthProvider, providerAccountId: string): Promise<OAuthAccount | null> {
    try {
      const [account] = await this.db
        .select()
        .from(oauthAccounts)
        .where(and(
          eq(oauthAccounts.provider, provider),
          eq(oauthAccounts.providerAccountId, providerAccountId)
        ))
        .limit(1);

      return account || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find OAuth account by provider: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 获取用户的所有OAuth账户
   */
  async getUserOauthAccounts(userId: string): Promise<OauthAccountInfo[]> {
    try {
      const accounts = await this.db
        .select()
        .from(oauthAccounts)
        .where(eq(oauthAccounts.userId, userId))
        .orderBy(desc(oauthAccounts.createdAt));

      return accounts.map(account => this.mapToAccountInfo(account));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user OAuth accounts: ${errorMessage}`);
      throw new BadRequestException('Failed to get user OAuth accounts');
    }
  }

  /**
   * 更新OAuth账户的访问令牌
   */
  async updateAccessToken(
    accountId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<OAuthAccount> {
    try {
      const [updatedAccount] = await this.db
        .update(oauthAccounts)
        .set({
          accessToken,
          refreshToken,
          expiresAt,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(oauthAccounts.id, accountId))
        .returning();

      if (!updatedAccount) {
        throw new NotFoundException('OAuth account not found');
      }

      this.logger.log(`OAuth account token updated: ${accountId}`);
      return updatedAccount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update OAuth account token: ${errorMessage}`);
      throw new BadRequestException('Failed to update OAuth account token');
    }
  }

  /**
   * 更新OAuth账户的用户数据
   */
  async updateUserData(
    accountId: string,
    userData: GitHubUserData | GitLabUserData,
    provider: OauthProvider
  ): Promise<OAuthAccount> {
    try {
      const updateData: Partial<OAuthAccount> = {
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      };

      if (provider === 'github') {
        updateData.githubData = userData as GitHubUserData;
      } else if (provider === 'gitlab') {
        updateData.gitlabData = userData as GitLabUserData;
      }

      const [updatedAccount] = await this.db
        .update(oauthAccounts)
        .set(updateData)
        .where(eq(oauthAccounts.id, accountId))
        .returning();

      if (!updatedAccount) {
        throw new NotFoundException('OAuth account not found');
      }

      this.logger.log(`OAuth account user data updated: ${accountId}`);
      return updatedAccount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update OAuth account user data: ${errorMessage}`);
      throw new BadRequestException('Failed to update OAuth account user data');
    }
  }

  /**
   * 删除OAuth账户
   */
  async deleteOauthAccount(accountId: string): Promise<boolean> {
    try {
      await this.db
        .delete(oauthAccounts)
        .where(eq(oauthAccounts.id, accountId));

      this.logger.log(`OAuth account deleted: ${accountId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete OAuth account: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 根据用户ID和提供商删除OAuth账户
   */
  async deleteByUserAndProvider(userId: string, provider: OauthProvider): Promise<boolean> {
    try {
      await this.db
        .delete(oauthAccounts)
        .where(and(
          eq(oauthAccounts.userId, userId),
          eq(oauthAccounts.provider, provider)
        ));

      this.logger.log(`OAuth account deleted: ${provider} for user: ${userId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete OAuth account by user and provider: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 获取OAuth账户统计信息
   */
  async getOauthAccountStats(userId?: string): Promise<OauthAccountStats> {
    try {
      const baseCondition = userId ? eq(oauthAccounts.userId, userId) : undefined;

      const [totalResult] = await this.db
        .select({ count: count() })
        .from(oauthAccounts)
        .where(baseCondition);

      const [githubResult] = await this.db
        .select({ count: count() })
        .from(oauthAccounts)
        .where(userId ? and(
          eq(oauthAccounts.userId, userId),
          eq(oauthAccounts.provider, 'github')
        ) : eq(oauthAccounts.provider, 'github'));

      const [gitlabResult] = await this.db
        .select({ count: count() })
        .from(oauthAccounts)
        .where(userId ? and(
          eq(oauthAccounts.userId, userId),
          eq(oauthAccounts.provider, 'gitlab')
        ) : eq(oauthAccounts.provider, 'gitlab'));

      return {
        totalAccounts: totalResult.count,
        activeAccounts: totalResult.count, // 假设所有账户都是活跃的
        githubAccounts: githubResult.count,
        gitlabAccounts: gitlabResult.count,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get OAuth account stats: ${errorMessage}`);
      throw new BadRequestException('Failed to get OAuth account statistics');
    }
  }

  /**
   * 检查用户是否有特定提供商的OAuth账户
   */
  async hasProviderAccount(userId: string, provider: OauthProvider): Promise<boolean> {
    try {
      const [account] = await this.db
        .select({ id: oauthAccounts.id })
        .from(oauthAccounts)
        .where(and(
          eq(oauthAccounts.userId, userId),
          eq(oauthAccounts.provider, provider)
        ))
        .limit(1);

      return !!account;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check provider account: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 获取即将过期的访问令牌
   */
  async getExpiringTokens(hoursBeforeExpiry: number = 1): Promise<OAuthAccount[]> {
    try {
      const expiryThreshold = new Date(Date.now() + hoursBeforeExpiry * 60 * 60 * 1000);

      const accounts = await this.db
        .select()
        .from(oauthAccounts)
        .where(and(
          isNotNull(oauthAccounts.expiresAt),
          lt(oauthAccounts.expiresAt, expiryThreshold)
        ))
        .orderBy(oauthAccounts.expiresAt);

      return accounts;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get expiring tokens: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 批量删除用户的OAuth账户
   */
  async deleteUserOauthAccounts(userId: string): Promise<number> {
    try {
      await this.db
        .delete(oauthAccounts)
        .where(eq(oauthAccounts.userId, userId));

      this.logger.log(`Deleted OAuth accounts for user: ${userId}`);
      return 1; // 简化返回值，实际应用中可以计算删除的数量
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete user OAuth accounts: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 根据ID获取OAuth账户详情
   */
  async getOauthAccountById(accountId: string): Promise<OAuthAccount | null> {
    try {
      const [account] = await this.db
        .select()
        .from(oauthAccounts)
        .where(eq(oauthAccounts.id, accountId))
        .limit(1);

      return account || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get OAuth account by ID: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 更新OAuth账户的最后使用时间
   */
  async updateLastUsed(accountId: string): Promise<void> {
    try {
      await this.db
        .update(oauthAccounts)
        .set({
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(oauthAccounts.id, accountId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update OAuth account last used: ${errorMessage}`);
    }
  }

  /**
   * 搜索OAuth账户
   */
  async searchOauthAccounts(
    query: string,
    provider?: OauthProvider,
    limit: number = 20,
    offset: number = 0
  ): Promise<OauthAccountInfo[]> {
    try {
      // 这里简化搜索逻辑，实际应用中可能需要更复杂的搜索
      let whereCondition = eq(oauthAccounts.providerAccountId, query);
      
      if (provider) {
        whereCondition = and(whereCondition, eq(oauthAccounts.provider, provider)) || whereCondition;
      }

      const accounts = await this.db
        .select()
        .from(oauthAccounts)
        .where(whereCondition)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(oauthAccounts.createdAt));

      return accounts.map(account => this.mapToAccountInfo(account));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search OAuth accounts: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 将OAuth账户映射为账户信息
   */
  private mapToAccountInfo(account: OAuthAccount): OauthAccountInfo {
    let email: string | undefined;
    let name: string | undefined;
    let avatarUrl: string | undefined;
    let profileUrl: string | undefined;

    if (account.provider === 'github' && account.githubData) {
      const githubData = account.githubData as any;
      email = githubData.email;
      name = githubData.name || githubData.login;
      avatarUrl = githubData.avatarUrl;
      profileUrl = githubData.htmlUrl;
    } else if (account.provider === 'gitlab' && account.gitlabData) {
      const gitlabData = account.gitlabData as any;
      email = gitlabData.email || gitlabData.publicEmail;
      name = gitlabData.name || gitlabData.username;
      avatarUrl = gitlabData.avatarUrl;
      profileUrl = gitlabData.webUrl;
    }

    return {
      id: account.id,
      provider: account.provider as OauthProvider,
      providerAccountId: account.providerAccountId,
      email,
      name,
      avatarUrl,
      profileUrl,
      isActive: !account.expiresAt || account.expiresAt > new Date(),
      lastUsedAt: account.lastUsedAt || undefined,
      createdAt: account.createdAt,
    };
  }
}