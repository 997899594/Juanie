import type { H3Event } from 'h3'
import { 
  setHeader, 
  setResponseStatus, 
  sendRedirect,
  setCookie,
  deleteCookie
} from 'h3'
import type { H3ResponseContext } from '../interfaces/h3-context.interface.js'
import { ResponseType } from '../constants/nitro.constants.js'

/**
 * 响应配置接口
 */
export interface ResponseConfig {
  statusCode?: number
  headers?: Record<string, string>
  cookies?: Record<string, CookieOptions>
  type?: ResponseType
  encoding?: string
  compress?: boolean
}

/**
 * Cookie 选项接口
 */
export interface CookieOptions {
  value: string
  maxAge?: number
  expires?: Date
  path?: string
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

/**
 * 文件响应选项
 */
export interface FileResponseOptions {
  filename?: string
  contentType?: string
  inline?: boolean
  lastModified?: Date
  etag?: string
  cacheControl?: string
}

/**
 * 响应工具类
 */
export class ResponseUtils {
  /**
   * 发送 JSON 响应
   */
  static async sendJson(
    event: H3Event, 
    data: any, 
    config?: ResponseConfig
  ): Promise<void> {
    const { statusCode = 200, headers = {}, cookies } = config || {}
    
    // 设置状态码
    setResponseStatus(event, statusCode)
    
    // 设置 JSON 内容类型
    setHeader(event, 'content-type', 'application/json; charset=utf-8')
    
    // 设置自定义头部
    Object.entries(headers).forEach(([key, value]) => {
      setHeader(event, key, value)
    })
    
    // 设置 Cookies
    if (cookies) {
      this.setCookies(event, cookies)
    }
    
    // 发送响应
    const jsonString = JSON.stringify(data, null, config?.compress ? 0 : 2)
    // 使用原生 Node.js 响应
    if (event.node?.res && !event.node.res.headersSent) {
      event.node.res.end(jsonString)
    }
  }

  /**
   * 发送文本响应
   */
  static async sendText(
    event: H3Event, 
    text: string, 
    config?: ResponseConfig
  ): Promise<void> {
    const { statusCode = 200, headers = {}, cookies } = config || {}
    
    setResponseStatus(event, statusCode)
    setHeader(event, 'content-type', 'text/plain; charset=utf-8')
    
    Object.entries(headers).forEach(([key, value]) => {
      setHeader(event, key, value)
    })
    
    if (cookies) {
      this.setCookies(event, cookies)
    }
    
    // 使用原生 Node.js 响应
    if (event.node?.res && !event.node.res.headersSent) {
      event.node.res.end(text)
    }
  }

  /**
   * 发送 HTML 响应
   */
  static async sendHtml(
    event: H3Event, 
    html: string, 
    config?: ResponseConfig
  ): Promise<void> {
    const { statusCode = 200, headers = {}, cookies } = config || {}
    
    setResponseStatus(event, statusCode)
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    
    Object.entries(headers).forEach(([key, value]) => {
      setHeader(event, key, value)
    })
    
    if (cookies) {
      this.setCookies(event, cookies)
    }
    
    // 使用原生 Node.js 响应
    if (event.node?.res && !event.node.res.headersSent) {
      event.node.res.end(html)
    }
  }

  /**
   * 发送文件响应
   */
  static async sendFile(
    event: H3Event,
    filePath: string,
    options?: FileResponseOptions
  ): Promise<void> {
    const { 
      filename, 
      contentType, 
      inline = false,
      lastModified,
      etag,
      cacheControl 
    } = options || {}
    
    // 设置内容类型
    if (contentType) {
      setHeader(event, 'content-type', contentType)
    } else {
      // 根据文件扩展名推断内容类型
      const inferredType = this.inferContentType(filePath)
      setHeader(event, 'content-type', inferredType)
    }
    
    // 设置文件名
    if (filename) {
      const disposition = inline ? 'inline' : 'attachment'
      setHeader(event, 'content-disposition', `${disposition}; filename="${filename}"`)
    }
    
    // 设置缓存头
    if (lastModified) {
      setHeader(event, 'last-modified', lastModified.toUTCString())
    }
    
    if (etag) {
      setHeader(event, 'etag', etag)
    }
    
    if (cacheControl) {
      setHeader(event, 'cache-control', cacheControl)
    }
    
    // 这里需要实际的文件读取逻辑
    // 暂时返回文件路径作为占位符
    // 使用原生 Node.js 响应
      if (event.node?.res && !event.node.res.headersSent) {
        event.node.res.end(`File: ${filePath}`)
      }
  }

  /**
   * 发送重定向响应
   */
  static async sendRedirect(
    event: H3Event,
    url: string,
    statusCode: number = 302
  ): Promise<void> {
    await sendRedirect(event, url, statusCode)
  }

  /**
   * 发送错误响应
   */
  static async sendError(
    event: H3Event,
    error: {
      statusCode?: number
      message?: string
      details?: any
      stack?: string
    },
    includeStack: boolean = false
  ): Promise<void> {
    const { 
      statusCode = 500, 
      message = 'Internal Server Error', 
      details,
      stack 
    } = error
    
    setResponseStatus(event, statusCode)
    setHeader(event, 'content-type', 'application/json; charset=utf-8')
    
    const errorResponse: any = {
      error: {
        statusCode,
        message,
        timestamp: new Date().toISOString()
      }
    }
    
    if (details) {
      errorResponse.error.details = details
    }
    
    if (includeStack && stack) {
      errorResponse.error.stack = stack
    }
    
    // 使用原生 Node.js 响应
    if (event.node?.res && !event.node.res.headersSent) {
      event.node.res.end(JSON.stringify(errorResponse, null, 2))
    }
  }

  /**
   * 发送空响应
   */
  static async sendEmpty(
    event: H3Event,
    statusCode: number = 204
  ): Promise<void> {
    setResponseStatus(event, statusCode)
    // 使用原生 Node.js 响应
    if (event.node?.res && !event.node.res.headersSent) {
      event.node.res.end('')
    }
  }

  /**
   * 发送流响应
   */
  static async sendStream(
    event: H3Event,
    stream: ReadableStream,
    config?: ResponseConfig & { 
      contentLength?: number
      transferEncoding?: string 
    }
  ): Promise<void> {
    const { 
      statusCode = 200, 
      headers = {}, 
      contentLength,
      transferEncoding = 'chunked' 
    } = config || {}
    
    setResponseStatus(event, statusCode)
    
    // 设置流相关头部
    if (contentLength !== undefined) {
      setHeader(event, 'content-length', String(contentLength))
    } else {
      setHeader(event, 'transfer-encoding', transferEncoding)
    }
    
    Object.entries(headers).forEach(([key, value]) => {
      setHeader(event, key, value)
    })
    
    // 这里需要实际的流处理逻辑
    // 暂时发送占位符
    // 使用原生 Node.js 响应
    if (event.node?.res && !event.node.res.headersSent) {
      event.node.res.end('Stream response')
    }
  }

  /**
   * 设置 Cookies
   */
  private static setCookies(
    event: H3Event, 
    cookies: Record<string, CookieOptions>
  ): void {
    Object.entries(cookies).forEach(([name, options]) => {
      const { value, ...cookieOptions } = options
      setCookie(event, name, value, cookieOptions)
    })
  }

  /**
   * 推断内容类型
   */
  private static inferContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav'
    }
    
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }
}

/**
 * 响应构建器类
 */
export class ResponseBuilder {
  private statusCode: number = 200
  private headers: Record<string, string> = {}
  private cookies: Record<string, CookieOptions> = {}
  private body: any = null
  private type: ResponseType = ResponseType.JSON

  /**
   * 设置状态码
   */
  status(code: number): this {
    this.statusCode = code
    return this
  }

  /**
   * 设置头部
   */
  header(name: string, value: string): this {
    this.headers[name] = value
    return this
  }

  /**
   * 设置多个头部
   */
  setHeaders(headers: Record<string, string>): this {
    Object.assign(this.headers, headers)
    return this
  }

  /**
   * 设置 Cookie
   */
  cookie(name: string, value: string, options?: Omit<CookieOptions, 'value'>): this {
    this.cookies[name] = { value, ...options }
    return this
  }

  /**
   * 删除 Cookie
   */
  clearCookie(name: string): this {
    this.cookies[name] = {
      value: '',
      expires: new Date(0)
    }
    return this
  }

  /**
   * 设置响应类型
   */
  responseType(type: ResponseType): this {
    this.type = type
    return this
  }

  /**
   * 设置 JSON 响应
   */
  json(data: any): this {
    this.body = data
    this.type = ResponseType.JSON
    return this
  }

  /**
   * 设置文本响应
   */
  text(text: string): this {
    this.body = text
    this.type = ResponseType.TEXT
    return this
  }

  /**
   * 设置 HTML 响应
   */
  html(html: string): this {
    this.body = html
    this.type = ResponseType.HTML
    return this
  }

  /**
   * 发送响应
   */
  async send(event: H3Event): Promise<void> {
    const config: ResponseConfig = {
      statusCode: this.statusCode,
      headers: this.headers,
      cookies: this.cookies,
      type: this.type
    }

    switch (this.type) {
      case ResponseType.JSON:
        await ResponseUtils.sendJson(event, this.body, config)
        break
      case ResponseType.TEXT:
        await ResponseUtils.sendText(event, this.body, config)
        break
      case ResponseType.HTML:
        await ResponseUtils.sendHtml(event, this.body, config)
        break
      default:
        await ResponseUtils.sendJson(event, this.body, config)
    }
  }
}

/**
 * 快捷响应函数
 */

/**
 * 创建成功响应
 */
export function success(data: any, message?: string) {
  return {
    success: true,
    data,
    message: message || 'Success',
    timestamp: new Date().toISOString()
  }
}

/**
 * 创建错误响应
 */
export function error(message: string, code?: string, details?: any) {
  return {
    success: false,
    error: {
      message,
      code: code || 'UNKNOWN_ERROR',
      details,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 创建分页响应
 */
export function paginated(
  data: any[], 
  total: number, 
  page: number, 
  limit: number
) {
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    },
    timestamp: new Date().toISOString()
  }
}

/**
 * 创建响应构建器
 */
export function response(): ResponseBuilder {
  return new ResponseBuilder()
}

/**
 * 处理条件响应
 */
export async function conditionalResponse(
  event: H3Event,
  etag?: string,
  lastModified?: Date
): Promise<boolean> {
  const ifNoneMatch = event.node?.req?.headers['if-none-match']
  const ifModifiedSince = event.node?.req?.headers['if-modified-since']
  
  // 检查 ETag
  if (etag && ifNoneMatch) {
    if (ifNoneMatch === etag || ifNoneMatch === '*') {
      setResponseStatus(event, 304)
      // 使用原生 Node.js 响应
      if (event.node?.res && !event.node.res.headersSent) {
        event.node.res.end('')
      }
      return true
    }
  }
  
  // 检查 Last-Modified
  if (lastModified && ifModifiedSince) {
    const modifiedSince = new Date(ifModifiedSince)
    if (lastModified <= modifiedSince) {
      setResponseStatus(event, 304)
      // 使用原生 Node.js 响应
      if (event.node?.res && !event.node.res.headersSent) {
        event.node.res.end('')
      }
      return true
    }
  }
  
  return false
}