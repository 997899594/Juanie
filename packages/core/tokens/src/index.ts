/**
 * 共享的依赖注入令牌
 * 所有服务包使用相同的 Symbol
 */

// 数据库连接
export const DATABASE = Symbol('DATABASE')

// Redis 连接
export const REDIS = Symbol('REDIS')

// 其他共享令牌可以在这里添加
