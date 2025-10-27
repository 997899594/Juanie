import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index, foreignKey, uniqueIndex } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { users } from './users.schema';

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // OAuth Provider Info
    provider: varchar('provider', { length: 50 }).notNull(), // 'github', 'gitlab'
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    
    // Token Management
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenType: varchar('token_type', { length: 50 }).default('bearer'),
    scope: text('scope'),
    expiresAt: timestamp('expires_at'),
    
    // Provider-specific data
    githubData: jsonb('github_data').$type<{
      login?: string;
      nodeId?: string;
      avatarUrl?: string;
      gravatarId?: string;
      url?: string;
      htmlUrl?: string;
      followersUrl?: string;
      followingUrl?: string;
      gistsUrl?: string;
      starredUrl?: string;
      subscriptionsUrl?: string;
      organizationsUrl?: string;
      reposUrl?: string;
      eventsUrl?: string;
      receivedEventsUrl?: string;
      type?: string;
      siteAdmin?: boolean;
      name?: string;
      company?: string;
      blog?: string;
      location?: string;
      email?: string;
      hireable?: boolean;
      bio?: string;
      twitterUsername?: string;
      publicRepos?: number;
      publicGists?: number;
      followers?: number;
      following?: number;
      createdAt?: string;
      updatedAt?: string;
    }>(),
    
    gitlabData: jsonb('gitlab_data').$type<{
      username?: string;
      name?: string;
      state?: string;
      avatarUrl?: string;
      webUrl?: string;
      createdAt?: string;
      bio?: string;
      location?: string;
      publicEmail?: string;
      skype?: string;
      linkedin?: string;
      twitter?: string;
      websiteUrl?: string;
      organization?: string;
      jobTitle?: string;
      pronouns?: string;
      bot?: boolean;
      workInformation?: string;
      followersCount?: number;
      followingCount?: number;
      localTime?: string;
      lastSignInAt?: string;
      confirmedAt?: string;
      lastActivityOn?: string;
      email?: string;
      themeId?: number;
      colorSchemeId?: number;
      projectsLimit?: number;
      currentSignInAt?: string;
      identities?: Array<{
        provider: string;
        externUid: string;
      }>;
      canCreateGroup?: boolean;
      canCreateProject?: boolean;
      twoFactorEnabled?: boolean;
      external?: boolean;
      privateProfile?: boolean;
      commitEmail?: string;
    }>(),
    
    // Permissions & Scopes
    permissions: jsonb('permissions').$type<{
      read?: boolean;
      write?: boolean;
      admin?: boolean;
      scopes?: string[];
    }>(),
    
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'),
  }
);

// 索引定义

// Zod schemas for validation
export const insertOAuthAccountSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  provider: z.enum(['github', 'gitlab']),
  providerAccountId: z.string().min(1).max(255),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenType: z.string().max(50).default('bearer'),
  scope: z.string().optional(),
  expiresAt: z.date().optional(),
  githubData: z.record(z.string(), z.any()).optional(),
  gitlabData: z.record(z.string(), z.any()).optional(),
  permissions: z.record(z.string(), z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  lastUsedAt: z.date().optional(),
});

export const selectOAuthAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  provider: z.enum(['github', 'gitlab']),
  providerAccountId: z.string(),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  tokenType: z.string().nullable(),
  scope: z.string().nullable(),
  expiresAt: z.date().nullable(),
  githubData: z.record(z.string(), z.any()).nullable(),
  gitlabData: z.record(z.string(), z.any()).nullable(),
  permissions: z.record(z.string(), z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastUsedAt: z.date().nullable(),
});

export const updateOAuthAccountSchema = selectOAuthAccountSchema.pick({
  userId: true,
  provider: true,
  providerAccountId: true,
  accessToken: true,
  refreshToken: true,
  tokenType: true,
  scope: true,
  expiresAt: true,
  githubData: true,
  gitlabData: true,
  permissions: true,
  lastUsedAt: true,
}).partial();

export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
export type UpdateOAuthAccount = z.infer<typeof updateOAuthAccountSchema>;