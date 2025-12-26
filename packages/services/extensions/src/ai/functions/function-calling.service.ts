import type { AIFunction } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { type ZodSchema, z } from 'zod'

/**
 * 可执行函数定义
 */
export interface ExecutableFunction extends AIFunction {
  /** 函数执行器 */
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown
  /** 参数验证 Schema (Zod) */
  schema?: ZodSchema
}

/**
 * 函数执行结果
 */
export interface FunctionExecutionResult {
  /** 函数名称 */
  functionName: string
  /** 执行是否成功 */
  success: boolean
  /** 执行结果 */
  result?: unknown
  /** 错误信息 */
  error?: string
  /** 执行耗时（毫秒） */
  duration: number
}

/**
 * Function Calling 服务
 *
 * 实现 AI Function Calling 功能，支持：
 * - 函数注册和管理
 * - 参数验证
 * - 函数执行
 * - 错误处理
 *
 * **Validates: Requirements 10.1, 10.4, 10.5**
 */
@Injectable()
export class FunctionCallingService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(FunctionCallingService.name)
  }

  private readonly functions = new Map<string, ExecutableFunction>()

  /**
   * 注册可调用函数
   *
   * @param func 函数定义
   *
   * **Validates: Requirements 10.1**
   */
  registerFunction(func: ExecutableFunction): void {
    if (this.functions.has(func.name)) {
      this.logger.warn(`Function ${func.name} is already registered, overwriting`)
    }

    this.functions.set(func.name, func)
    this.logger.info(`Registered function: ${func.name}`)
  }

  /**
   * 批量注册函数
   *
   * @param functions 函数列表
   */
  registerFunctions(functions: ExecutableFunction[]): void {
    for (const func of functions) {
      this.registerFunction(func)
    }
  }

  /**
   * 注销函数
   *
   * @param name 函数名称
   */
  unregisterFunction(name: string): boolean {
    const deleted = this.functions.delete(name)
    if (deleted) {
      this.logger.info(`Unregistered function: ${name}`)
    }
    return deleted
  }

  /**
   * 获取函数定义
   *
   * @param name 函数名称
   * @returns 函数定义，如果不存在返回 undefined
   *
   * **Validates: Requirements 10.1**
   */
  getFunction(name: string): ExecutableFunction | undefined {
    return this.functions.get(name)
  }

  /**
   * 获取所有已注册的函数
   *
   * @returns 函数列表
   */
  getAllFunctions(): ExecutableFunction[] {
    return Array.from(this.functions.values())
  }

  /**
   * 获取所有函数的 AI 定义（用于传递给 AI 模型）
   *
   * @returns AI 函数定义列表
   */
  getAIFunctionDefinitions(): AIFunction[] {
    return Array.from(this.functions.values()).map((func) => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters,
    }))
  }

  /**
   * 验证函数参数
   *
   * @param functionName 函数名称
   * @param args 参数对象
   * @returns 验证结果
   *
   * **Validates: Requirements 10.4**
   */
  validateArguments(
    functionName: string,
    args: Record<string, unknown>,
  ): { valid: boolean; error?: string } {
    const func = this.functions.get(functionName)

    if (!func) {
      return {
        valid: false,
        error: `Function ${functionName} not found`,
      }
    }

    // 如果提供了 Zod schema，使用它进行验证
    if (func.schema) {
      try {
        func.schema.parse(args)
        return { valid: true }
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessages = error.issues
            .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
            .join(', ')
          return {
            valid: false,
            error: `Validation failed: ${errorMessages}`,
          }
        }
        return {
          valid: false,
          error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    }

    // 如果没有 schema，进行基本的 JSON Schema 验证
    // 这里简化处理，实际应该使用 ajv 等库进行完整的 JSON Schema 验证
    const schema = func.parameters
    if (schema && typeof schema === 'object' && 'required' in schema) {
      const required = schema.required as string[]
      for (const key of required) {
        if (!(key in args)) {
          return {
            valid: false,
            error: `Missing required parameter: ${key}`,
          }
        }
      }
    }

    return { valid: true }
  }

  /**
   * 执行函数
   *
   * @param functionName 函数名称
   * @param args 参数对象
   * @returns 执行结果
   *
   * **Validates: Requirements 10.5**
   */
  async executeFunction(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<FunctionExecutionResult> {
    const startTime = Date.now()

    try {
      // 获取函数定义
      const func = this.functions.get(functionName)
      if (!func) {
        return {
          functionName,
          success: false,
          error: `Function ${functionName} not found`,
          duration: Date.now() - startTime,
        }
      }

      // 验证参数
      const validation = this.validateArguments(functionName, args)
      if (!validation.valid) {
        return {
          functionName,
          success: false,
          error: validation.error,
          duration: Date.now() - startTime,
        }
      }

      // 执行函数
      this.logger.info(`Executing function: ${functionName}`, { args })
      const result = await func.handler(args)

      const duration = Date.now() - startTime
      this.logger.info(`Function ${functionName} executed successfully`, {
        duration,
      })

      return {
        functionName,
        success: true,
        result,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error(`Function ${functionName} execution failed`, error as Error, {
        args,
        duration,
      })

      return {
        functionName,
        success: false,
        error: errorMessage,
        duration,
      }
    }
  }

  /**
   * 批量执行函数
   *
   * @param calls 函数调用列表
   * @returns 执行结果列表
   */
  async executeFunctions(
    calls: Array<{ name: string; arguments: Record<string, unknown> }>,
  ): Promise<FunctionExecutionResult[]> {
    const results: FunctionExecutionResult[] = []

    for (const call of calls) {
      const result = await this.executeFunction(call.name, call.arguments)
      results.push(result)
    }

    return results
  }

  /**
   * 检查函数是否存在
   *
   * @param name 函数名称
   * @returns 是否存在
   */
  hasFunction(name: string): boolean {
    return this.functions.has(name)
  }

  /**
   * 获取已注册函数数量
   *
   * @returns 函数数量
   */
  getFunctionCount(): number {
    return this.functions.size
  }

  /**
   * 清空所有已注册的函数
   */
  clearFunctions(): void {
    this.functions.clear()
    this.logger.info('Cleared all registered functions')
  }
}
