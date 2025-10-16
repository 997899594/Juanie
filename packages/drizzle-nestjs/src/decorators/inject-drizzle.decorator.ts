import { Inject } from '@nestjs/common'
import { DRIZZLE_CONNECTION, DEFAULT_CONNECTION_NAME } from '../constants/drizzle.constants.js'

/**
 * 注入 Drizzle 数据库连接装饰器
 * 
 * @param connectionName 连接名称，默认为 'default'
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(
 *     @InjectDrizzle() private readonly db: DrizzleDatabase,
 *     @InjectDrizzle('secondary') private readonly secondaryDb: DrizzleDatabase
 *   ) {}
 * }
 * ```
 */
export function InjectDrizzle(connectionName: string = DEFAULT_CONNECTION_NAME): ParameterDecorator {
  return Inject(getDrizzleConnectionToken(connectionName))
}

/**
 * 获取 Drizzle 连接 Token
 */
export function getDrizzleConnectionToken(connectionName: string = DEFAULT_CONNECTION_NAME): string | symbol {
  return connectionName === DEFAULT_CONNECTION_NAME 
    ? DRIZZLE_CONNECTION 
    : `${DRIZZLE_CONNECTION.toString()}_${connectionName}`
}

/**
 * 注入 Drizzle 服务装饰器
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(
 *     @InjectDrizzleService() private readonly drizzleService: DrizzleService
 *   ) {}
 * }
 * ```
 */
export function InjectDrizzleService(): ParameterDecorator {
  return Inject('DrizzleService')
}