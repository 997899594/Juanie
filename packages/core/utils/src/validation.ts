/**
 * 验证工具函数
 */

/**
 * 检查是否为有效的 UUID
 * @param uuid - UUID 字符串
 * @returns 是否为有效 UUID
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * 检查是否为有效的 email
 * @param email - email 字符串
 * @returns 是否为有效 email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 检查是否为有效的 URL
 * @param url - URL 字符串
 * @returns 是否为有效 URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 检查是否为有效的 slug（URL 友好的标识符）
 * @param slug - slug 字符串
 * @returns 是否为有效 slug
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  return slugRegex.test(slug)
}

/**
 * 检查密码强度
 * @param password - 密码字符串
 * @returns 密码强度对象
 */
export function checkPasswordStrength(password: string): {
  score: number
  isStrong: boolean
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0

  // 长度检查
  if (password.length >= 8) {
    score += 1
  } else {
    feedback.push('密码至少需要 8 个字符')
  }

  if (password.length >= 12) {
    score += 1
  }

  // 包含小写字母
  if (/[a-z]/.test(password)) {
    score += 1
  } else {
    feedback.push('密码需要包含小写字母')
  }

  // 包含大写字母
  if (/[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('密码需要包含大写字母')
  }

  // 包含数字
  if (/\d/.test(password)) {
    score += 1
  } else {
    feedback.push('密码需要包含数字')
  }

  // 包含特殊字符
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1
  } else {
    feedback.push('密码需要包含特殊字符')
  }

  return {
    score,
    isStrong: score >= 4,
    feedback,
  }
}

/**
 * 验证对象是否包含所有必需的键
 * @param obj - 要验证的对象
 * @param requiredKeys - 必需的键数组
 * @returns 验证结果
 */
export function hasRequiredKeys<T extends Record<string, any>>(
  obj: T,
  requiredKeys: string[],
): { valid: boolean; missing: string[] } {
  const missing = requiredKeys.filter((key) => !(key in obj))
  return {
    valid: missing.length === 0,
    missing,
  }
}
