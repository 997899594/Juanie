import { Injectable, Logger } from '@nestjs/common'
import type { H3Event } from 'h3'
import { 
  readBody, 
  getQuery, 
  getRouterParams, 
  getHeaders, 
  getCookie, 
  setHeader,
  setResponseStatus
} from 'h3'
import type { 
  H3EventContext, 
  H3ResponseContext, 
  H3MiddlewareContext,
  H3RouteInfo,
  H3RequestStats 
} from '../interfaces/h3-context.interface.js'
import { H3_CONTEXT } from '../constants/nitro.constants.js'

/**
 * H3 适配器类
 * 负责将 H3 事件转换为 NestJS 可处理的格式
 */
@Injectable()
export class H3Adapter {
  private readonly logger = new Logger(H3Adapter.name)

  /**
   * 将 H3 事件转换为 NestJS 请求对象
   */
  async adaptRequest(event: H3Event): Promise<any> {
    const startTime = Date.now()
    
    try {
      // 解析请求体
      const body = await this.parseBody(event)
      
      // 解析查询参数
      const query = getQuery(event)
      
      // 解析路径参数
      const params = getRouterParams(event) || {}
      
      // 解析请求头并处理类型
      const rawHeaders = getHeaders(event)
      const processedHeaders: Record<string, string | string[]> = {}
      
      for (const [key, value] of Object.entries(rawHeaders)) {
        if (value !== undefined) {
          processedHeaders[key] = typeof value === 'string' ? value : String(value)
        }
      }
      
     // 获取客户端信息
      const ip = event.node?.req?.socket?.remoteAddress || 'unknown'
      const userAgent = processedHeaders['user-agent'] as string || 'unknown'
      
      // 创建 H3 上下文
      const h3Context: H3EventContext = {
        event,
        method: event.node?.req?.method || 'GET',
        url: event.node?.req?.url || '/',
        path: event.path || '/',
        query: query as Record<string, string | string[]>,
        params,
        headers: processedHeaders as Partial<Record<string, string>>,
        body,
        ip,
        userAgent,
        timestamp: new Date(),
        requestId: this.generateRequestId(),
        cookies: this.parseCookies(event),
        files: [], // 文件上传需要额外处理
        session: null, // 会话需要额外配置
        auth: undefined, // 认证信息需要额外处理
        metadata: {}
      }

      // 创建模拟的 Express 风格请求对象
      const request = {
        method: h3Context.method,
        url: h3Context.url,
        path: h3Context.path,
        query: h3Context.query,
        params: h3Context.params,
        headers: h3Context.headers,
        body: h3Context.body,
        ip: h3Context.ip,
        get: (name: string) => h3Context.headers[name.toLowerCase()],
        header: (name: string) => h3Context.headers[name.toLowerCase()],
        [H3_CONTEXT.toString()]: h3Context,
        routeInfo: this.createRouteInfo(event),
        stats: this.createRequestStats(startTime)
      }

      return request
    } catch (error) {
      this.logger.error('Failed to adapt H3 request:', error)
      throw error
    }
  }

  /**
   * 创建 NestJS 响应对象
   */
  createResponse(event: H3Event): any {
    const h3Response: H3ResponseContext = {
      statusCode: 200,
      headers: {},
      cookies: [],
      sent: false,
      body: null
    }

    const response = {
      status: (code: number) => {
        h3Response.statusCode = code
        setResponseStatus(event, code)
        return response
      },
      header: (name: string, value: string) => {
        if (!h3Response.headers) {
          h3Response.headers = {}
        }
        h3Response.headers[name] = value
        setHeader(event, name, value)
        return response
      },
      setHeader: (name: string, value: string) => {
        if (!h3Response.headers) {
          h3Response.headers = {}
        }
        h3Response.headers[name] = value
        setHeader(event, name, value)
        return response
      },
      cookie: (name: string, value: string, options?: any) => {
        if (!h3Response.cookies) {
          h3Response.cookies = []
        }
        h3Response.cookies.push({ name, value, options })
        // H3 cookie 设置需要额外实现
        return response
      },
      send: (body: any) => {
        h3Response.body = body
        h3Response.sent = true
        // 使用原生 Node.js 响应
        if (event.node?.res && !event.node.res.headersSent) {
          event.node.res.end(body)
        }
        return response
      },
      json: (body: any) => {
        h3Response.body = body
        h3Response.sent = true
        setHeader(event, 'content-type', 'application/json')
        // 使用原生 Node.js 响应
        if (event.node?.res && !event.node.res.headersSent) {
          event.node.res.end(JSON.stringify(body))
        }
        return response
      },
      end: (body?: any) => {
        if (body !== undefined) {
          h3Response.body = body
        }
        h3Response.sent = true
        // 使用原生 Node.js 响应
        if (event.node?.res && !event.node.res.headersSent) {
          event.node.res.end(body)
        }
        return response
      },
      h3Response,
      h3Event: event
    }

    return response
  }

  /**
   * 解析请求体
   */
  private async parseBody(event: H3Event): Promise<any> {
    try {
      const contentType = (getHeaders(event)['content-type'] as string) || ''
      
      if (contentType.includes('application/json')) {
        return await readBody(event)
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        return await readBody(event)
      } else if (contentType.includes('multipart/form-data')) {
        // 文件上传需要特殊处理
        return await readBody(event)
      } else {
        return await readBody(event)
      }
    } catch (error) {
      // 如果解析失败，返回 null
      return null
    }
  }

  /**
   * 解析 Cookies
   */
  private parseCookies(event: H3Event): Record<string, string> {
    const cookies: Record<string, string> = {}
    const cookieHeader = getHeaders(event).cookie as string
    
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=')
        if (name && value) {
          cookies[name] = decodeURIComponent(value)
        }
      })
    }
    
    return cookies
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 创建路由信息
   */
  private createRouteInfo(event: H3Event): H3RouteInfo {
    return {
      path: event.path || '/',
      method: event.node?.req?.method || 'GET',
      params: getRouterParams(event) || {},
      matched: event.path || '/',
      handler: 'unknown'
    }
  }

  /**
   * 创建请求统计信息
   */
  private createRequestStats(startTime: number): H3RequestStats {
    return {
      id: Math.random().toString(36).substring(2, 15),
      startTime: new Date(startTime),
      duration: 0, // 将在请求结束时更新
      memoryUsage: process.memoryUsage(),
      requestSize: 0, // 需要计算
      responseSize: 0 // 需要计算
    }
  }

  /**
   * 处理中间件上下文
   */
  createMiddlewareContext(event: H3Event, next?: Function): H3MiddlewareContext {
    if (!event.node?.req || !event.node?.res) {
      throw new Error('Invalid H3 event: missing node request or response')
    }
    
    const eventContext = this.createEventContextFromEvent(event)
    const responseContext: H3ResponseContext = {
      statusCode: 200,
      headers: {},
      body: undefined
    }
    
    return {
      event: eventContext,
      response: responseContext,
      next: (next as (() => void | Promise<void>)) || (() => {}),
      error: undefined,
      meta: {}
    }
  }

  /**
   * 创建事件上下文
   */
  private createEventContextFromEvent(event: H3Event): H3EventContext {
    const rawHeaders = getHeaders(event)
    const processedHeaders: Record<string, string | string[]> = {}
    
    for (const [key, value] of Object.entries(rawHeaders)) {
      if (value !== undefined) {
        processedHeaders[key] = typeof value === 'string' ? value : String(value)
      }
    }
    
    return {
      event,
      url: event.node?.req?.url || '/',
      method: event.node?.req?.method || 'GET',
      headers: processedHeaders as Partial<Record<string, string>>,
      query: getQuery(event),
      params: getRouterParams(event) || {},
      body: null,
      files: [],
      ip: event.node?.req?.socket?.remoteAddress || 'unknown'
    }
  }

  /**
   * 处理错误响应
   */
  handleError(event: H3Event, error: any): void {
    this.logger.error('H3 Adapter Error:', error)
    
    const statusCode = error.status || error.statusCode || 500
    const message = error.message || 'Internal Server Error'
    
    setResponseStatus(event, statusCode)
    setHeader(event, 'content-type', 'application/json')
    
    // 使用原生 Node.js 响应
    const errorResponse = JSON.stringify({
      error: {
        statusCode,
        message,
        timestamp: new Date().toISOString()
      }
    })
    
    if (event.node?.res && !event.node.res.headersSent) {
      event.node.res.end(errorResponse)
    }
  }

  /**
   * 更新请求统计信息
   */
  updateRequestStats(stats: H3RequestStats, responseSize?: number): void {
    const now = Date.now()
    stats.duration = now - stats.startTime.getTime()
    
    if (responseSize !== undefined) {
      stats.responseSize = responseSize
    }
  }

  /**
   * 验证请求
   */
  validateRequest(event: H3Event): boolean {
    try {
      // 基本验证
      if (!event.node?.req?.method) {
        return false
      }
      
      if (!event.node?.req?.url) {
        return false
      }
      
      return true
    } catch (error) {
      this.logger.error('Request validation failed:', error)
      return false
    }
  }

  /**
   * 清理资源
   */
  cleanup(event: H3Event): void {
    // 清理临时文件、关闭流等
    try {
      // 实现清理逻辑
    } catch (error) {
      this.logger.error('Cleanup failed:', error)
    }
  }
}