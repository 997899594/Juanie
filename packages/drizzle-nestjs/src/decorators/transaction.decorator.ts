import { SetMetadata, createParamDecorator } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { TransactionConfig } from '../interfaces/drizzle-connection.interface.js'
import { DRIZZLE_TRANSACTION, DEFAULT_CONNECTION_NAME } from '../constants/drizzle.constants.js'

/**
 * 事务元数据键
 */
export const TRANSACTION_METADATA_KEY = Symbol('TRANSACTION_METADATA')

/**
 * 事务配置元数据
 */
export interface TransactionMetadata extends TransactionConfig {
  /**
   * 连接名称
   */
  connectionName?: string
  
  /**
   * 是否自动提交
   */
  autoCommit?: boolean
  
  /**
   * 是否传播事务
   */
  propagation?: 'required' | 'requires_new' | 'supports' | 'not_supported'
}

/**
 * 事务装饰器
 * 
 * @param config 事务配置
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   @Transaction()
 *   async createUser(userData: CreateUserDto) {
 *     // 这个方法会在事务中执行
 *   }
 * 
 *   @Transaction({ 
 *     isolationLevel: TransactionIsolationLevel.SERIALIZABLE,
 *     timeout: 5000 
 *   })
 *   async complexOperation() {
 *     // 自定义事务配置
 *   }
 * }
 * ```
 */
export function Transaction(config: TransactionMetadata = {}): MethodDecorator {
  const metadata: TransactionMetadata = {
    connectionName: DEFAULT_CONNECTION_NAME,
    autoCommit: true,
    propagation: 'required',
    ...config,
  }
  
  return SetMetadata(TRANSACTION_METADATA_KEY, metadata)
}

/**
 * 注入事务上下文装饰器
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   @Transaction()
 *   async createUser(
 *     userData: CreateUserDto,
 *     @InjectTransaction() tx: TransactionContext
 *   ) {
 *     // 使用事务上下文
 *     await tx.tx.insert(users).values(userData)
 *   }
 * }
 * ```
 */
export const InjectTransaction = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const connectionName = data || DEFAULT_CONNECTION_NAME
    
    // 从请求上下文中获取事务
    return request[`${DRIZZLE_TRANSACTION.toString()}_${connectionName}`]
  },
)

/**
 * 获取事务元数据
 */
export function getTransactionMetadata(target: any, propertyKey: string): TransactionMetadata | undefined {
  return Reflect.getMetadata(TRANSACTION_METADATA_KEY, target, propertyKey)
}

/**
 * 检查方法是否有事务装饰器
 */
export function hasTransactionDecorator(target: any, propertyKey: string): boolean {
  return Reflect.hasMetadata(TRANSACTION_METADATA_KEY, target, propertyKey)
}

/**
 * 只读事务装饰器
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   @ReadOnlyTransaction()
 *   async getUsers() {
 *     // 只读事务
 *   }
 * }
 * ```
 */
export function ReadOnlyTransaction(config: Omit<TransactionMetadata, 'readOnly'> = {}): MethodDecorator {
  return Transaction({ ...config, readOnly: true })
}

/**
 * 新事务装饰器（总是创建新事务）
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   @NewTransaction()
 *   async independentOperation() {
 *     // 总是在新事务中执行
 *   }
 * }
 * ```
 */
export function NewTransaction(config: Omit<TransactionMetadata, 'propagation'> = {}): MethodDecorator {
  return Transaction({ ...config, propagation: 'requires_new' })
}