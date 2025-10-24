import { z } from 'zod';
import { idSchema } from './common.schema';

// OAuth提供商枚举
export const oauthProviderSchema = z.enum(['gitlab', 'github']);

// 登录输入schema
export const loginInputSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少6位'),
});

// 注册输入schema
export const registerInputSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少6位'),
  name: z.string().min(1, '请输入姓名'),
});

// 更新用户输入schema
export const updateUserInputSchema = z.object({
  name: z.string().min(1, '请输入姓名').optional(),
  email: z.string().email('请输入有效的邮箱地址').optional(),
});

// 创建认证URL请求
export const createAuthUrlSchema = z.object({
  provider: oauthProviderSchema,
  redirectTo: z.string().url().optional(),
  state: z.string().optional(),
});

// OAuth回调处理
export const oauthCallbackSchema = z.object({
  provider: oauthProviderSchema,
  code: z.string().min(1),
  state: z.string().optional(),
});

// 会话验证
export const validateSessionSchema = z.object({
  sessionId: z.string().min(1),
});

// 用户信息响应
export const userResponseSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  name: z.string(),
  image: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// 会话信息响应
export const sessionResponseSchema = z.object({
  id: z.string(),
  userId: z.number().int(),
  expires: z.date(),
  createdAt: z.date(),
});

// 认证响应
export const authResponseSchema = z.object({
  user: userResponseSchema,
  session: sessionResponseSchema,
  accessToken: z.string().optional(),
});

// 认证URL响应
export const authUrlResponseSchema = z.object({
  url: z.string().url(),
  state: z.string().optional(),
});

// 退出登录请求
export const logoutSchema = z.object({
  sessionId: z.string().optional(),
  allSessions: z.boolean().default(false),
});

// 会话列表查询
export const listSessionsSchema = z.object({
  userId: z.number().int().optional(),
  active: z.boolean().optional(),
});

// 账户信息响应
export const accountResponseSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  provider: oauthProviderSchema,
  providerId: z.string(),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// 用户权限schema
export const userPermissionSchema = z.object({
  resource: z.string(),
  action: z.string(),
  granted: z.boolean(),
});

// 权限检查请求
export const checkPermissionSchema = z.object({
  userId: z.number().int(),
  resource: z.string(),
  action: z.string(),
});

// 类型推断
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type CreateAuthUrlInput = z.infer<typeof createAuthUrlSchema>;
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;
export type ValidateSessionInput = z.infer<typeof validateSessionSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type AuthUrlResponse = z.infer<typeof authUrlResponseSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ListSessionsInput = z.infer<typeof listSessionsSchema>;
export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type UserPermission = z.infer<typeof userPermissionSchema>;
export type CheckPermissionInput = z.infer<typeof checkPermissionSchema>;