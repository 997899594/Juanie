import { pgTable, uuid, text, timestamp, jsonb, boolean, index, uniqueIndex, varchar, pgEnum } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { organizations } from './organizations.schema';

// 身份提供商类型（支持企业级 SSO 与 OAuth/OIDC）
export const IdentityProviderTypeEnum = z.enum(['github', 'gitlab', 'oidc', 'saml']);
export const IdentityProviderTypePgEnum = pgEnum('identity_provider_type', ['github', 'gitlab', 'oidc', 'saml']);

export const identityProviders = pgTable('identity_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 组织ID：表示该身份提供商属于哪个组织（企业级SSO场景）
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),

  // 身份提供商类型：github、gitlab、oidc、saml
  providerType: IdentityProviderTypePgEnum('provider_type').notNull(),

  // 身份提供商名称：用于在管理后台显示的名称（如“公司GitLab SSO”）
  name: text('name').notNull(),

  // 客户端ID：用于与身份提供商进行OAuth/OIDC通信的客户端ID
  clientId: text('client_id'),

  // 客户端密钥：用于与身份提供商进行OAuth/OIDC通信的客户端密钥（建议加密或使用密钥管理）
  clientSecret: text('client_secret'),

  // 发卡者URL：OIDC的Issuer地址（例如 https://gitlab.com 或企业OIDC IdP）
  issuerUrl: text('issuer_url'),

  // 授权端点：OAuth/OIDC授权请求的URL
  authorizationUrl: text('authorization_url'),

  // 令牌端点：OAuth/OIDC获取访问令牌的URL
  tokenUrl: text('token_url'),

  // 用户信息端点：OIDC标准的用户信息获取地址
  userInfoUrl: text('user_info_url'),

  // 回调地址：平台的重定向URI（注册在IdP），用于完成授权回调
  redirectUri: text('redirect_uri'),

  // 请求范围：申请的权限范围（逗号分隔或空格分隔），例如 openid profile email api
  scope: text('scope'),

  // 配置项：IdP特定的配置，如Claim映射、组映射、默认项目权限等
  settings: jsonb('settings').$type<{
    claimMapping?: Record<string, string>; // IdP返回字段到平台用户字段的映射
    groupMapping?: Record<string, string>; // IdP组到平台团队/角色的映射
    defaultRoleSlug?: string; // 首次登录赋予的默认角色
    allowedDomains?: string[]; // 允许登录的邮箱域
    enforceMFA?: boolean; // 是否要求MFA
    allowSignup?: boolean; // 是否允许新用户注册
  }>(),

  // 是否启用：控制该身份提供商当前是否对组织用户生效
  enabled: boolean('enabled').notNull().default(true),

  // 备注：管理员对该配置的简要说明
  description: text('description'),

  // 时间戳：创建与更新
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 索引与唯一约束
export const identityProvidersIndexes = {
  orgIdx: index('identity_providers_org_idx').on(identityProviders.organizationId),
  typeIdx: index('identity_providers_type_idx').on(identityProviders.providerType),
  uniqueOrgName: uniqueIndex('identity_providers_org_name_unique').on(identityProviders.organizationId, identityProviders.name),
};

// Zod Schemas
export const insertIdentityProviderSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  providerType: IdentityProviderTypeEnum,
  name: z.string().min(1),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  issuerUrl: z.string().optional(),
  authorizationUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  userInfoUrl: z.string().optional(),
  redirectUri: z.string().optional(),
  scope: z.string().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectIdentityProviderSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  providerType: IdentityProviderTypeEnum,
  name: z.string(),
  clientId: z.string().nullable(),
  clientSecret: z.string().nullable(),
  issuerUrl: z.string().nullable(),
  authorizationUrl: z.string().nullable(),
  tokenUrl: z.string().nullable(),
  userInfoUrl: z.string().nullable(),
  redirectUri: z.string().nullable(),
  scope: z.string().nullable(),
  settings: z.record(z.string(), z.any()).nullable(),
  enabled: z.boolean(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const updateIdentityProviderSchema = z.object({
  organizationId: z.string().uuid().optional(),
  providerType: IdentityProviderTypeEnum.optional(),
  name: z.string().optional(),
  clientId: z.string().nullable().optional(),
  clientSecret: z.string().nullable().optional(),
  issuerUrl: z.string().nullable().optional(),
  authorizationUrl: z.string().nullable().optional(),
  tokenUrl: z.string().nullable().optional(),
  userInfoUrl: z.string().nullable().optional(),
  redirectUri: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  settings: z.record(z.string(), z.any()).nullable().optional(),
  enabled: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

export type IdentityProvider = typeof identityProviders.$inferSelect;
export type NewIdentityProvider = typeof identityProviders.$inferInsert;
export type UpdateIdentityProvider = z.infer<typeof updateIdentityProviderSchema>;
export type IdentityProviderType = z.infer<typeof IdentityProviderTypeEnum>;
