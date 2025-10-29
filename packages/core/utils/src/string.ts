/**
 * 字符串工具函数
 */

/**
 * 将字符串转换为 slug（URL 友好格式）
 * @param str - 原始字符串
 * @returns slug 格式的字符串
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // 移除特殊字符
    .replace(/[\s_-]+/g, '-') // 替换空格和下划线为连字符
    .replace(/^-+|-+$/g, '') // 移除首尾的连字符
}

/**
 * 截断字符串
 * @param str - 原始字符串
 * @param maxLength - 最大长度
 * @param suffix - 后缀，默认为 '...'
 * @returns 截断后的字符串
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength - suffix.length) + suffix
}

/**
 * 首字母大写
 * @param str - 原始字符串
 * @returns 首字母大写的字符串
 */
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * 驼峰命名转换为蛇形命名
 * @param str - 驼峰命名字符串
 * @returns 蛇形命名字符串
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * 蛇形命名转换为驼峰命名
 * @param str - 蛇形命名字符串
 * @returns 驼峰命名字符串
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * 生成随机字符串
 * @param length - 字符串长度
 * @param charset - 字符集，默认为字母数字
 * @returns 随机字符串
 */
export function randomString(
  length: number,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return result
}

/**
 * 掩码敏感信息（如 email）
 * @param str - 原始字符串
 * @param visibleStart - 开始可见字符数
 * @param visibleEnd - 结束可见字符数
 * @param maskChar - 掩码字符
 * @returns 掩码后的字符串
 */
export function maskString(str: string, visibleStart = 3, visibleEnd = 3, maskChar = '*'): string {
  if (str.length <= visibleStart + visibleEnd) {
    return str
  }
  const start = str.slice(0, visibleStart)
  const end = str.slice(-visibleEnd)
  const maskLength = str.length - visibleStart - visibleEnd
  return start + maskChar.repeat(maskLength) + end
}
