/**
 * Nitro 模块常量
 */
export const NITRO_OPTIONS = Symbol('NITRO_OPTIONS')
export const NITRO_APP = Symbol('NITRO_APP')
export const H3_EVENT = Symbol('H3_EVENT')
export const H3_CONTEXT = Symbol('H3_CONTEXT')

/**
 * HTTP 方法枚举
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  ALL = 'ALL',
}

/**
 * 路由处理器类型
 */
export enum HandlerType {
  API = 'api',
  MIDDLEWARE = 'middleware',
  PLUGIN = 'plugin',
  ROUTE = 'route',
}

/**
 * 响应类型
 */
export enum ResponseType {
  JSON = 'application/json',
  HTML = 'text/html',
  TEXT = 'text/plain',
  XML = 'application/xml',
  STREAM = 'application/octet-stream',
}

/**
 * 缓存策略
 */
export enum CacheStrategy {
  NO_CACHE = 'no-cache',
  PRIVATE = 'private',
  PUBLIC = 'public',
  IMMUTABLE = 'immutable',
}

/**
 * 错误代码
 */
export enum ErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  prefix: '/api',
  cors: {
    enabled: true,
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  rateLimit: {
    enabled: false,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  compression: {
    enabled: true,
    threshold: 1024, // compress responses > 1kb
  },
  security: {
    helmet: true,
    csrf: false,
  },
} as const

/**
 * 元数据键
 */
export const METADATA_KEYS = {
  HANDLER: Symbol('nitro:handler'),
  ROUTE: Symbol('nitro:route'),
  METHOD: Symbol('nitro:method'),
  MIDDLEWARE: Symbol('nitro:middleware'),
  CACHE: Symbol('nitro:cache'),
  RATE_LIMIT: Symbol('nitro:rateLimit'),
  CORS: Symbol('nitro:cors'),
} as const