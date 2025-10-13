import { z } from 'zod'

export const configValidationSchema = z.object({
  // 数据库配置
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Redis 配置
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // GitHub OAuth 配置
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  GITHUB_REDIRECT_URI: z.string().url('GITHUB_REDIRECT_URI must be a valid URL'),

  // GitLab OAuth 配置
  GITLAB_CLIENT_ID: z.string().min(1, 'GITLAB_CLIENT_ID is required'),
  GITLAB_CLIENT_SECRET: z.string().min(1, 'GITLAB_CLIENT_SECRET is required'),
  GITLAB_REDIRECT_URI: z.string().url('GITLAB_REDIRECT_URI must be a valid URL'),

  // 应用配置
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3000'),

  // 安全配置
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters').optional(),

  // 监控配置（可选）
  SENTRY_DSN: z.string().url().optional(),
  PROMETHEUS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
})

export type Config = z.infer<typeof configValidationSchema>
