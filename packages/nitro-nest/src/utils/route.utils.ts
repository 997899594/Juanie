import type { H3Event } from 'h3'
import { getRouterParams, getQuery } from 'h3'
import type { H3RouteInfo } from '../interfaces/h3-context.interface.js'
import { HttpMethod } from '../constants/nitro.constants.js'

/**
 * 路由配置接口
 */
export interface RouteConfig {
  path: string
  method: HttpMethod
  handler: string
  middleware?: string[]
  params?: Record<string, any>
  query?: Record<string, any>
  meta?: Record<string, any>
}

/**
 * 路由匹配结果
 */
export interface RouteMatch {
  matched: boolean
  route?: RouteConfig
  params?: Record<string, string>
  query?: Record<string, string>
  score: number
}

/**
 * 路由解析器类
 */
export class RouteParser {
  private static readonly PARAM_REGEX = /:([a-zA-Z_$][a-zA-Z0-9_$]*)/g
  private static readonly WILDCARD_REGEX = /\*/g
  private static readonly OPTIONAL_REGEX = /\?/g

  /**
   * 解析路由路径，提取参数名
   */
  static parsePath(path: string): {
    pattern: RegExp
    params: string[]
    segments: string[]
  } {
    const params: string[] = []
    const segments = path.split('/').filter(Boolean)
    
    // 提取参数名
    let paramMatch
    while ((paramMatch = this.PARAM_REGEX.exec(path)) !== null) {
      params.push(paramMatch[1])
    }
    
    // 转换为正则表达式
    let pattern = path
      .replace(this.PARAM_REGEX, '([^/]+)')
      .replace(this.WILDCARD_REGEX, '(.*)')
      .replace(this.OPTIONAL_REGEX, '?')
    
    // 确保完全匹配
    pattern = `^${pattern}$`
    
    return {
      pattern: new RegExp(pattern),
      params,
      segments
    }
  }

  /**
   * 匹配路由
   */
  static matchRoute(
    requestPath: string, 
    routePath: string, 
    method: HttpMethod,
    requestMethod: string
  ): RouteMatch {
    // 检查 HTTP 方法
    if (method !== HttpMethod.ALL && method.toLowerCase() !== requestMethod.toLowerCase()) {
      return { matched: false, score: 0 }
    }
    
    const { pattern, params } = this.parsePath(routePath)
    const match = requestPath.match(pattern)
    
    if (!match) {
      return { matched: false, score: 0 }
    }
    
    // 提取参数值
    const paramValues: Record<string, string> = {}
    params.forEach((param, index) => {
      paramValues[param] = match[index + 1]
    })
    
    // 计算匹配分数（越具体的路由分数越高）
    const score = this.calculateScore(routePath, requestPath)
    
    return {
      matched: true,
      params: paramValues,
      score
    }
  }

  /**
   * 计算路由匹配分数
   */
  private static calculateScore(routePath: string, requestPath: string): number {
    let score = 0
    
    // 完全匹配得分最高
    if (routePath === requestPath) {
      score += 1000
    }
    
    // 静态段得分
    const routeSegments = routePath.split('/').filter(Boolean)
    const requestSegments = requestPath.split('/').filter(Boolean)
    
    for (let i = 0; i < Math.min(routeSegments.length, requestSegments.length); i++) {
      const routeSegment = routeSegments[i]
      const requestSegment = requestSegments[i]
      
      if (routeSegment === requestSegment) {
        score += 10 // 静态段匹配
      } else if (routeSegment.startsWith(':')) {
        score += 5 // 参数段匹配
      } else if (routeSegment === '*') {
        score += 1 // 通配符匹配
      }
    }
    
    // 路径长度匹配度
    if (routeSegments.length === requestSegments.length) {
      score += 5
    }
    
    return score
  }
}

/**
 * 路由工具函数
 */

/**
 * 标准化路由路径
 */
export function normalizePath(path: string): string {
  if (!path || path === '/') {
    return '/'
  }
  
  // 移除尾部斜杠
  path = path.replace(/\/+$/, '')
  
  // 确保以斜杠开头
  if (!path.startsWith('/')) {
    path = '/' + path
  }
  
  // 标准化多个斜杠
  path = path.replace(/\/+/g, '/')
  
  return path
}

/**
 * 合并路径
 */
export function joinPaths(...paths: string[]): string {
  const normalizedPaths = paths
    .filter(Boolean)
    .map(path => path.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
  
  if (normalizedPaths.length === 0) {
    return '/'
  }
  
  return '/' + normalizedPaths.join('/')
}

/**
 * 提取路由参数
 */
export function extractRouteParams(event: H3Event): Record<string, string> {
  return getRouterParams(event) || {}
}

/**
 * 提取查询参数
 */
export function extractQueryParams(event: H3Event): Record<string, string> {
  const query = getQuery(event)
  const result: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      result[key] = value
    } else if (Array.isArray(value)) {
      result[key] = value[0] as string
    } else if (value !== undefined && value !== null) {
      result[key] = String(value)
    }
  }
  
  return result
}

/**
 * 验证路由路径
 */
export function validateRoutePath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false
  }
  
  // 检查基本格式
  if (!path.startsWith('/')) {
    return false
  }
  
  // 检查非法字符
  const invalidChars = /[<>"|\\^`{}\s]/
  if (invalidChars.test(path)) {
    return false
  }
  
  // 检查参数格式
  const paramRegex = /:([a-zA-Z_$][a-zA-Z0-9_$]*)/g
  let match
  const params = new Set<string>()
  
  while ((match = paramRegex.exec(path)) !== null) {
    const paramName = match[1]
    
    // 检查参数名重复
    if (params.has(paramName)) {
      return false
    }
    
    params.add(paramName)
  }
  
  return true
}

/**
 * 生成路由键
 */
export function generateRouteKey(method: HttpMethod, path: string): string {
  return `${method.toUpperCase()}:${normalizePath(path)}`
}

/**
 * 解析路由模式
 */
export function parseRoutePattern(pattern: string): {
  isWildcard: boolean
  isParam: boolean
  isOptional: boolean
  name?: string
} {
  const isWildcard = pattern === '*'
  const isParam = pattern.startsWith(':')
  const isOptional = pattern.endsWith('?')
  
  let name: string | undefined
  if (isParam) {
    name = pattern.slice(1).replace('?', '')
  }
  
  return {
    isWildcard,
    isParam,
    isOptional,
    name
  }
}

/**
 * 构建路由信息
 */
export function buildRouteInfo(
  event: H3Event,
  routePath: string,
  handler: string
): H3RouteInfo {
  const method = event.node?.req?.method || 'GET'
  const path = event.path || '/'
  const params = extractRouteParams(event)
  
  return {
    path: routePath,
    method,
    params,
    matched: path,
    handler
  }
}

/**
 * 检查路由冲突
 */
export function checkRouteConflict(
  routes: Array<{ method: HttpMethod; path: string }>
): Array<{ route1: string; route2: string; reason: string }> {
  const conflicts: Array<{ route1: string; route2: string; reason: string }> = []
  
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const route1 = routes[i]
      const route2 = routes[j]
      
      // 检查相同方法的路由
      if (route1.method === route2.method || 
          route1.method === HttpMethod.ALL || 
          route2.method === HttpMethod.ALL) {
        
        const key1 = generateRouteKey(route1.method, route1.path)
        const key2 = generateRouteKey(route2.method, route2.path)
        
        // 检查路径冲突
        if (isPathConflict(route1.path, route2.path)) {
          conflicts.push({
            route1: key1,
            route2: key2,
            reason: 'Path pattern conflict'
          })
        }
      }
    }
  }
  
  return conflicts
}

/**
 * 检查路径冲突
 */
function isPathConflict(path1: string, path2: string): boolean {
  // 完全相同
  if (path1 === path2) {
    return true
  }
  
  const segments1 = path1.split('/').filter(Boolean)
  const segments2 = path2.split('/').filter(Boolean)
  
  // 长度不同但有一个是通配符
  if (segments1.length !== segments2.length) {
    const hasWildcard1 = segments1.some(s => s === '*')
    const hasWildcard2 = segments2.some(s => s === '*')
    
    if (hasWildcard1 || hasWildcard2) {
      return true
    }
    
    return false
  }
  
  // 逐段比较
  for (let i = 0; i < segments1.length; i++) {
    const seg1 = segments1[i]
    const seg2 = segments2[i]
    
    // 通配符匹配所有
    if (seg1 === '*' || seg2 === '*') {
      return true
    }
    
    // 参数段可能冲突
    if (seg1.startsWith(':') && seg2.startsWith(':')) {
      continue // 参数名不同但模式相同，可能冲突
    }
    
    // 参数段与静态段
    if ((seg1.startsWith(':') && !seg2.startsWith(':')) ||
        (!seg1.startsWith(':') && seg2.startsWith(':'))) {
      return true
    }
    
    // 静态段必须完全匹配
    if (seg1 !== seg2) {
      return false
    }
  }
  
  return true
}

/**
 * 格式化路由列表
 */
export function formatRouteList(
  routes: Array<{ method: HttpMethod; path: string; handler: string }>
): string {
  const maxMethodLength = Math.max(...routes.map(r => r.method.length))
  const maxPathLength = Math.max(...routes.map(r => r.path.length))
  
  return routes
    .map(route => {
      const method = route.method.padEnd(maxMethodLength)
      const path = route.path.padEnd(maxPathLength)
      return `${method} ${path} -> ${route.handler}`
    })
    .join('\n')
}