/**
 * Zod 验证错误格式化工具
 * 兼容 Zod v4+ 版本
 */

import { ZodError, type ZodIssue } from 'zod'

/**
 * 格式化 Zod 验证错误信息
 */
export function formatZodErrorMessage(error: ZodError): string {
  const issues = error.issues.map(formatSingleIssue)
  return issues.join('; ')
}

/**
 * 格式化单个验证错误
 */
function formatSingleIssue(issue: ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : 'root'

  switch (issue.code) {
    case 'invalid_type':
      return `${path}: 期望 ${(issue as any).expected}，实际收到 ${(issue as any).received}`

    case 'too_small': {
      const tooSmallIssue = issue as any
      if (tooSmallIssue.type === 'string') {
        return `${path}: 字符串长度至少需要 ${tooSmallIssue.minimum} 个字符`
      }
      if (tooSmallIssue.type === 'number') {
        return `${path}: 数值必须大于等于 ${tooSmallIssue.minimum}`
      }
      if (tooSmallIssue.type === 'array') {
        return `${path}: 数组长度至少需要 ${tooSmallIssue.minimum} 个元素`
      }
      return `${path}: 值太小，最小值为 ${tooSmallIssue.minimum}`
    }

    case 'too_big': {
      const tooBigIssue = issue as any
      if (tooBigIssue.type === 'string') {
        return `${path}: 字符串长度不能超过 ${tooBigIssue.maximum} 个字符`
      }
      if (tooBigIssue.type === 'number') {
        return `${path}: 数值必须小于等于 ${tooBigIssue.maximum}`
      }
      if (tooBigIssue.type === 'array') {
        return `${path}: 数组长度不能超过 ${tooBigIssue.maximum} 个元素`
      }
      return `${path}: 值太大，最大值为 ${tooBigIssue.maximum}`
    }

    case 'invalid_format': {
      const formatIssue = issue as any
      if (formatIssue.format === 'email') {
        return `${path}: 请输入有效的邮箱地址`
      }
      if (formatIssue.format === 'url') {
        return `${path}: 请输入有效的 URL`
      }
      if (formatIssue.format === 'uuid') {
        return `${path}: 请输入有效的 UUID`
      }
      return `${path}: 字符串格式无效`
    }

    case 'unrecognized_keys': {
      const keysIssue = issue as any
      return `${path}: 包含未识别的字段: ${keysIssue.keys?.join(', ') || ''}`
    }

    case 'invalid_union':
      return `${path}: 不匹配任何联合类型`

    case 'invalid_value': {
      const valueIssue = issue as any
      return `${path}: 无效的值，期望 "${valueIssue.expected || ''}"`
    }

    case 'not_multiple_of': {
      const multipleIssue = issue as any
      return `${path}: 必须是 ${multipleIssue.multipleOf} 的倍数`
    }

    case 'custom':
      return issue.message || `${path}: 自定义验证失败`

    default:
      return issue.message || `${path}: 验证失败`
  }
}

/**
 * 创建友好的 Zod 错误
 */
export function createFriendlyZodError(error: ZodError): Error {
  const message = formatZodErrorMessage(error)
  const friendlyError = new Error(message)
  friendlyError.name = 'ValidationError'
  return friendlyError
}

/**
 * 使用友好错误信息进行验证
 */
export function validateWithFriendlyError<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown,
): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof ZodError) {
      throw createFriendlyZodError(error)
    }
    throw error
  }
}
