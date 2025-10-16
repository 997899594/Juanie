# @juanie/nitro-nest

一个强大的 NestJS 和 Nitro 集成包，提供 H3 事件处理、路由管理和中间件支持。

## 特性

- 🚀 **无缝集成** - 将 Nitro 的高性能与 NestJS 的强大功能结合
- 🔄 **H3 事件转换** - 自动将 H3 事件转换为 NestJS 可处理的格式
- 🛣️ **智能路由** - 支持动态路由、参数提取和路由验证
- 🎯 **装饰器支持** - 提供丰富的装饰器用于请求处理
- 🔧 **中间件系统** - 支持全局和路由级别的中间件
- 📊 **性能监控** - 内置请求统计和性能监控
- 🛡️ **类型安全** - 完整的 TypeScript 支持
- ⚡ **高性能** - 基于 Nitro 的高性能 HTTP 处理

## 安装

```bash
npm install @juanie/nitro-nest
# 或
yarn add @juanie/nitro-nest
# 或
pnpm add @juanie/nitro-nest
```

### 对等依赖

```bash
npm install @nestjs/common @nestjs/core nitropack h3
```

## 快速开始

### 基本配置

```typescript
import { Module } from '@nestjs/common'
import { NitroModule } from '@juanie/nitro-nest'

@Module({
  imports: [
    NitroModule.forRoot({
      port: 3000,
      debug: true,
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    })
  ]
})
export class AppModule {}
```

### 创建控制器

```typescript
import { Injectable } from '@nestjs/common'
import { 
  NitroHandler, 
  Get, 
  Post, 
  H3Context, 
  Body, 
  Query, 
  Param 
} from '@juanie/nitro-nest'
import type { H3EventContext } from '@juanie/nitro-nest'

@Injectable()
export class UserController {
  @Get('/users')
  async getUsers(@Query() query: Record<string, string>) {
    return {
      users: [],
      query
    }
  }

  @Get('/users/:id')
  async getUser(@Param('id') id: string) {
    return {
      user: { id, name: 'John Doe' }
    }
  }

  @Post('/users')
  async createUser(@Body() userData: any) {
    return {
      user: { id: '123', ...userData }
    }
  }

  @Get('/context-example')
  async contextExample(@H3Context() ctx: H3EventContext) {
    return {
      method: ctx.method,
      url: ctx.url,
      headers: ctx.headers,
      ip: ctx.ip
    }
  }
}
```

### 中间件支持

```typescript
import { Injectable } from '@nestjs/common'
import { Middleware, H3MiddlewareContext } from '@juanie/nitro-nest'

@Injectable()
export class AuthMiddleware {
  @Middleware('/api/*')
  async authenticate(ctx: H3MiddlewareContext) {
    const token = ctx.request.headers.authorization
    
    if (!token) {
      ctx.error = new Error('Unauthorized')
      return
    }
    
    // 验证 token 逻辑
    ctx.data.user = { id: '123', name: 'John' }
    await ctx.next()
  }
}
```

## 高级用法

### 异步配置

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NitroModule } from '@juanie/nitro-nest'

@Module({
  imports: [
    ConfigModule.forRoot(),
    NitroModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        port: configService.get('PORT', 3000),
        debug: configService.get('NODE_ENV') === 'development',
        cors: {
          origin: configService.get('CORS_ORIGIN', '*'),
          methods: ['GET', 'POST', 'PUT', 'DELETE']
        },
        rateLimit: {
          windowMs: 15 * 60 * 1000, // 15 分钟
          max: 100 // 限制每个 IP 100 次请求
        }
      }),
      inject: [ConfigService]
    })
  ]
})
export class AppModule {}
```

### 自定义装饰器

```typescript
import { Injectable } from '@nestjs/common'
import { 
  NitroHandler, 
  Cache, 
  RateLimit, 
  Cors,
  ResponseType 
} from '@juanie/nitro-nest'

@Injectable()
export class ApiController {
  @Get('/cached-data')
  @Cache({ ttl: 300 }) // 缓存 5 分钟
  async getCachedData() {
    return { data: 'This response is cached' }
  }

  @Post('/limited-endpoint')
  @RateLimit({ windowMs: 60000, max: 10 }) // 每分钟最多 10 次请求
  async limitedEndpoint(@Body() data: any) {
    return { received: data }
  }

  @Get('/cors-enabled')
  @Cors({ origin: 'https://example.com' })
  async corsEnabled() {
    return { message: 'CORS enabled for specific origin' }
  }

  @NitroHandler({
    path: '/custom-response',
    method: 'GET',
    responseType: ResponseType.HTML
  })
  async customResponse() {
    return '<h1>Custom HTML Response</h1>'
  }
}
```

### 文件上传处理

```typescript
import { Injectable } from '@nestjs/common'
import { Post, Files } from '@juanie/nitro-nest'

@Injectable()
export class UploadController {
  @Post('/upload')
  async uploadFiles(@Files() files: any[]) {
    return {
      message: 'Files uploaded successfully',
      files: files.map(file => ({
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      }))
    }
  }
}
```

### 响应工具

```typescript
import { Injectable } from '@nestjs/common'
import { Get, H3Event } from '@juanie/nitro-nest'
import { ResponseUtils, response, success, error } from '@juanie/nitro-nest'

@Injectable()
export class ResponseController {
  @Get('/json-response')
  async jsonResponse(@H3Event() event: any) {
    await ResponseUtils.sendJson(event, { message: 'Hello World' })
  }

  @Get('/builder-response')
  async builderResponse(@H3Event() event: any) {
    await response()
      .status(201)
      .header('X-Custom', 'value')
      .cookie('session', 'abc123')
      .json({ created: true })
      .send(event)
  }

  @Get('/success-response')
  async successResponse() {
    return success({ id: 123 }, 'User created successfully')
  }

  @Get('/error-response')
  async errorResponse() {
    return error('User not found', 'USER_NOT_FOUND')
  }
}
```

### 路由工具

```typescript
import { Injectable } from '@nestjs/common'
import { Get } from '@juanie/nitro-nest'
import { 
  normalizePath, 
  joinPaths, 
  validateRoutePath,
  RouteParser 
} from '@juanie/nitro-nest'

@Injectable()
export class RouteController {
  @Get('/route-info')
  async getRouteInfo() {
    const path = '/api/users/:id'
    const { pattern, params } = RouteParser.parsePath(path)
    
    return {
      originalPath: path,
      normalizedPath: normalizePath(path),
      isValid: validateRoutePath(path),
      pattern: pattern.source,
      params
    }
  }
}
```

## API 参考

### 模块配置

#### NitroModuleOptions

```typescript
interface NitroModuleOptions {
  port?: number
  debug?: boolean
  cors?: NitroCorsConfig
  rateLimit?: NitroRateLimitConfig
  compression?: NitroCompressionConfig
  security?: NitroSecurityConfig
  cache?: NitroCacheConfig
  logging?: NitroLoggingConfig
}
```

### 装饰器

#### 路由装饰器

- `@NitroHandler(config)` - 定义路由处理器
- `@Get(path)` - GET 请求
- `@Post(path)` - POST 请求
- `@Put(path)` - PUT 请求
- `@Delete(path)` - DELETE 请求
- `@Patch(path)` - PATCH 请求

#### 参数装饰器

- `@H3Context()` - 注入 H3 事件上下文
- `@H3Event()` - 注入原始 H3 事件
- `@Body()` - 注入请求体
- `@Query()` - 注入查询参数
- `@Param()` - 注入路径参数
- `@Headers()` - 注入请求头
- `@Files()` - 注入上传文件
- `@ClientIp()` - 注入客户端 IP
- `@UserAgent()` - 注入用户代理
- `@Session()` - 注入会话数据
- `@Auth()` - 注入认证信息

#### 功能装饰器

- `@Middleware(path)` - 定义中间件
- `@Cache(config)` - 配置缓存
- `@RateLimit(config)` - 配置速率限制
- `@Cors(config)` - 配置 CORS

### 服务

#### NitroService

```typescript
class NitroService {
  getApp(): any
  getNodeListener(): any
  registerHandler(path: string, method: HttpMethod, handler: Function, config?: RouteHandlerConfig): void
  registerMiddleware(path: string, middleware: Function, config?: any): void
  getStats(): any
  healthCheck(): Promise<{ status: string; details: any }>
}
```

#### H3Adapter

```typescript
class H3Adapter {
  adaptRequest(event: H3Event): Promise<any>
  createResponse(event: H3Event): any
  handleError(event: H3Event, error: any): void
  validateRequest(event: H3Event): boolean
}
```

### 工具函数

#### 响应工具

```typescript
class ResponseUtils {
  static sendJson(event: H3Event, data: any, config?: ResponseConfig): Promise<void>
  static sendText(event: H3Event, text: string, config?: ResponseConfig): Promise<void>
  static sendHtml(event: H3Event, html: string, config?: ResponseConfig): Promise<void>
  static sendError(event: H3Event, error: any, includeStack?: boolean): Promise<void>
  static sendRedirect(event: H3Event, url: string, statusCode?: number): Promise<void>
}
```

#### 路由工具

```typescript
class RouteParser {
  static parsePath(path: string): { pattern: RegExp; params: string[]; segments: string[] }
  static matchRoute(requestPath: string, routePath: string, method: HttpMethod, requestMethod: string): RouteMatch
}

function normalizePath(path: string): string
function joinPaths(...paths: string[]): string
function validateRoutePath(path: string): boolean
```

## 许可证

MIT © [Your Name]