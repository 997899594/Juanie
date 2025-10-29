/**
 * 日期工具函数
 * 基于 date-fns 提供常用的日期操作
 */

// 重新导出 date-fns 常用函数
export {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addSeconds,
  addWeeks,
  addYears,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInMonths,
  differenceInSeconds,
  differenceInWeeks,
  differenceInYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  formatDistance,
  formatDistanceToNow,
  formatISO,
  formatRelative,
  isAfter,
  isBefore,
  isEqual,
  isFuture,
  isPast,
  isThisMonth,
  isThisWeek,
  isThisYear,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subHours,
  subMinutes,
  subMonths,
  subSeconds,
  subWeeks,
  subYears,
} from 'date-fns'

/**
 * 检查日期是否过期
 * @param date - 要检查的日期
 * @param now - 当前时间（可选，默认为 new Date()）
 * @returns 是否过期
 */
export function isExpired(date: Date, now: Date = new Date()): boolean {
  return date.getTime() < now.getTime()
}

/**
 * 格式化持续时间（秒）为人类可读格式
 * @param seconds - 持续时间（秒）
 * @returns 格式化的字符串，如 "2h 30m 15s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0) parts.push(`${secs}s`)

  return parts.join(' ')
}
