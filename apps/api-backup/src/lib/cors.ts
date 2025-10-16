import { ConfigService } from '@nestjs/config'
import type { H3Event } from 'h3'
import { getRequestHeader, setHeader, setResponseStatus } from 'h3'
import { getService } from './utils/nest-service'

/**
 * 统一的 CORS 处理工具函数
 * 根据配置的允许源列表动态设置 CORS 头
 */
export function setCorsHeaders(event: H3Event): void {
  const origin = getRequestHeader(event, 'origin')
  const configService = getService(ConfigService)

  // 使用 NestJS 官方 ConfigService 获取 CORS 配置
  const allowedOrigins = configService.get<string[]>('CORS_ORIGINS', ['http://localhost:3000'])

  // 设置基础 CORS 头
  setHeader(event, 'Vary', 'Origin')
  setHeader(event, 'Access-Control-Allow-Credentials', 'true')
  setHeader(event, 'Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // 动态设置允许的源
  if (origin && allowedOrigins.includes(origin)) {
    setHeader(event, 'Access-Control-Allow-Origin', origin)
  }
}

/**
 * 处理 CORS 预检请求
 * 如果是 OPTIONS 请求，设置 CORS 头并返回 204
 */
export function handleCorsPreflightRequest(event: H3Event): boolean {
  if ((event.node.req.method || 'GET') === 'OPTIONS') {
    setCorsHeaders(event)
    setResponseStatus(event, 204)
    return true // 表示已处理预检请求
  }
  return false // 表示不是预检请求
}

/**
 * 完整的 CORS 处理中间件
 * 设置 CORS 头并处理预检请求
 */
export function handleCors(event: H3Event): boolean {
  // 先设置 CORS 头
  setCorsHeaders(event)

  // 如果是 OPTIONS 请求，设置状态码并返回 true 表示已处理
  if ((event.node.req.method || 'GET') === 'OPTIONS') {
    setResponseStatus(event, 204)
    return true // 表示已处理预检请求，不需要继续处理
  }

  return false // 表示不是预检请求，需要继续处理业务逻辑
}
