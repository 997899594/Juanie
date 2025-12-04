/**
 * 仓库名称验证和清理工具
 */

export interface RepositoryNameValidation {
  valid: boolean
  message?: string
  suggestion?: string
}

/**
 * 清理仓库名称，使其符合 GitHub/GitLab 命名规范
 * 规则：
 * - 只能包含字母、数字、连字符和下划线
 * - 不能以连字符开头
 * - 最长 100 个字符
 */
export function sanitizeRepositoryName(name: string): string {
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-') // 将非法字符替换为连字符
    .replace(/^-+/, '') // 移除开头的连字符
    .replace(/-+/g, '-') // 合并多个连续的连字符
    .replace(/-+$/, '') // 移除结尾的连字符
    .substring(0, 100) // 限制长度

  // 如果清理后为空，使用默认名称
  if (!sanitized) {
    sanitized = `project-${Date.now()}`
  }

  return sanitized
}

/**
 * 验证仓库名称是否符合规范
 */
export function validateRepositoryName(name: string): RepositoryNameValidation {
  if (!name || name.trim() === '') {
    return {
      valid: false,
      message: '仓库名称不能为空',
    }
  }

  // 检查长度
  if (name.length > 100) {
    return {
      valid: false,
      message: '仓库名称不能超过 100 个字符',
      suggestion: name.substring(0, 100),
    }
  }

  // 检查是否包含非法字符
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    const sanitized = sanitizeRepositoryName(name)
    return {
      valid: false,
      message: '仓库名称只能包含字母、数字、连字符和下划线',
      suggestion: sanitized,
    }
  }

  // 检查是否以连字符开头
  if (name.startsWith('-')) {
    return {
      valid: false,
      message: '仓库名称不能以连字符开头',
      suggestion: name.replace(/^-+/, ''),
    }
  }

  // 检查是否以连字符结尾
  if (name.endsWith('-')) {
    return {
      valid: false,
      message: '仓库名称不能以连字符结尾',
      suggestion: name.replace(/-+$/, ''),
    }
  }

  // 推荐使用小写
  if (name !== name.toLowerCase()) {
    return {
      valid: true,
      message: '建议使用小写字母',
      suggestion: name.toLowerCase(),
    }
  }

  return { valid: true }
}

/**
 * 从项目名称生成仓库名称
 */
export function generateRepositoryName(projectName: string): string {
  return sanitizeRepositoryName(projectName)
}
