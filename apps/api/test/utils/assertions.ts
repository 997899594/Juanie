/**
 * 自定义断言辅助函数
 * 用于简化测试中的常见断言
 */

import { expect } from 'vitest'

/**
 * 断言对象包含指定的属性
 */
export function expectToHaveProperties(obj: any, properties: string[]) {
  for (const prop of properties) {
    expect(obj).toHaveProperty(prop)
  }
}

/**
 * 断言对象是有效的 UUID
 */
export function expectToBeUUID(value: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  expect(value).toMatch(uuidRegex)
}

/**
 * 断言对象是有效的日期
 */
export function expectToBeDate(value: any) {
  expect(value).toBeInstanceOf(Date)
  expect(value.getTime()).not.toBeNaN()
}

/**
 * 断言对象是有效的 ISO 日期字符串
 */
export function expectToBeISODate(value: string) {
  const date = new Date(value)
  expect(date.toISOString()).toBe(value)
}

/**
 * 断言数组包含指定数量的元素
 */
export function expectArrayLength(arr: any[], length: number) {
  expect(Array.isArray(arr)).toBe(true)
  expect(arr).toHaveLength(length)
}

/**
 * 断言对象匹配部分属性
 */
export function expectToMatchObject(obj: any, partial: any) {
  expect(obj).toMatchObject(partial)
}

/**
 * 断言错误包含指定消息
 */
export function expectErrorMessage(error: any, message: string | RegExp) {
  expect(error).toBeInstanceOf(Error)
  if (typeof message === 'string') {
    expect(error.message).toContain(message)
  } else {
    expect(error.message).toMatch(message)
  }
}

/**
 * 断言 tRPC 错误
 */
export function expectTRPCError(error: any, code: string) {
  expect(error).toHaveProperty('code')
  expect(error.code).toBe(code)
}

/**
 * 断言对象已被软删除
 */
export function expectToBeDeleted(obj: any) {
  expect(obj).toHaveProperty('deletedAt')
  expect(obj.deletedAt).not.toBeNull()
  expectToBeDate(obj.deletedAt)
}

/**
 * 断言对象未被软删除
 */
export function expectNotToBeDeleted(obj: any) {
  expect(obj).toHaveProperty('deletedAt')
  expect(obj.deletedAt).toBeNull()
}

/**
 * 断言时间戳在指定范围内
 */
export function expectTimestampInRange(
  timestamp: Date,
  startTime: Date,
  endTime: Date = new Date(),
) {
  expect(timestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime())
  expect(timestamp.getTime()).toBeLessThanOrEqual(endTime.getTime())
}

/**
 * 断言对象包含标准时间戳字段
 */
export function expectToHaveTimestamps(obj: any) {
  expect(obj).toHaveProperty('createdAt')
  expect(obj).toHaveProperty('updatedAt')
  expectToBeDate(obj.createdAt)
  expectToBeDate(obj.updatedAt)
}
