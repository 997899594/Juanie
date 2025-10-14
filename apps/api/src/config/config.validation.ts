import { z } from 'zod'

// 用于 drizzle.config.ts 的最小环境校验
// 确保存在数据库连接字符串
export const configValidationSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
})
