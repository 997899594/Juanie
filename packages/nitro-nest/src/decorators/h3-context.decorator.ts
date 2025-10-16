import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { 
  H3EventContext, 
  H3ResponseContext, 
  H3MiddlewareContext,
  H3RouteInfo,
  H3RequestStats 
} from '../interfaces/h3-context.interface.js'
import { H3_EVENT, H3_CONTEXT } from '../constants/nitro.constants.js'

/**
 * 注入 H3 事件上下文装饰器
 * 
 * @example
 * ```typescript
 * @Get('/users')
 * async getUsers(@H3Context() ctx: H3EventContext) {
 *   const { query, headers, method } = ctx
 *   return { users: [] }
 * }
 * ```
 */
export const H3Context = createParamDecorator(
  (data: keyof H3EventContext | undefined, ctx: ExecutionContext): H3EventContext | any => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found. Make sure NitroModule is properly configured.')
    }
    
    return data ? h3Context[data] : h3Context
  },
)

/**
 * 注入 H3 原始事件装饰器
 * 
 * @example
 * ```typescript
 * @Get('/raw')
 * async getRaw(@H3Event() event: H3Event) {
 *   const body = await readBody(event)
 *   return { body }
 * }
 * ```
 */
export const H3Event = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return h3Context.event
  },
)

/**
 * 注入请求体装饰器
 * 
 * @example
 * ```typescript
 * @Post('/users')
 * async createUser(@Body() body: CreateUserDto) {
 *   return { user: body }
 * }
 * ```
 */
export const Body = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return data ? h3Context.body?.[data] : h3Context.body
  },
)

/**
 * 注入查询参数装饰器
 * 
 * @example
 * ```typescript
 * @Get('/users')
 * async getUsers(@Query('page') page: string, @Query() query: Record<string, string>) {
 *   return { users: [], page, query }
 * }
 * ```
 */
export const Query = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return data ? h3Context.query[data] : h3Context.query
  },
)

/**
 * 注入路径参数装饰器
 * 
 * @example
 * ```typescript
 * @Get('/users/:id')
 * async getUser(@Param('id') id: string, @Param() params: Record<string, string>) {
 *   return { user: { id }, params }
 * }
 * ```
 */
export const Param = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return data ? h3Context.params[data] : h3Context.params
  },
)

/**
 * 注入请求头装饰器
 * 
 * @example
 * ```typescript
 * @Get('/info')
 * async getInfo(@Headers('authorization') auth: string, @Headers() headers: Record<string, string>) {
 *   return { auth, headers }
 * }
 * ```
 */
export const Headers = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return data ? h3Context.headers[data] : h3Context.headers
  },
)

/**
 * 注入上传文件装饰器
 * 
 * @example
 * ```typescript
 * @Post('/upload')
 * async uploadFile(@Files() files: any[]) {
 *   return { files: files.map(f => f.filename) }
 * }
 * ```
 */
export const Files = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return h3Context.files || []
  },
)

/**
 * 注入客户端 IP 装饰器
 * 
 * @example
 * ```typescript
 * @Get('/ip')
 * async getIp(@ClientIp() ip: string) {
 *   return { ip }
 * }
 * ```
 */
export const ClientIp = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return h3Context.ip
  },
)

/**
 * 注入用户代理装饰器
 * 
 * @example
 * ```typescript
 * @Get('/user-agent')
 * async getUserAgent(@UserAgent() userAgent: string) {
 *   return { userAgent }
 * }
 * ```
 */
export const UserAgent = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return h3Context.userAgent
  },
)

/**
 * 注入会话装饰器
 * 
 * @example
 * ```typescript
 * @Get('/session')
 * async getSession(@Session() session: any, @Session('user') user: any) {
 *   return { session, user }
 * }
 * ```
 */
export const Session = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return data ? h3Context.session?.[data] : h3Context.session
  },
)

/**
 * 注入认证信息装饰器
 * 
 * @example
 * ```typescript
 * @Get('/profile')
 * async getProfile(@Auth() auth: any, @Auth('user') user: any) {
 *   return { auth, user }
 * }
 * ```
 */
export const Auth = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const h3Context = request[H3_CONTEXT.toString()] as H3EventContext
    
    if (!h3Context) {
      throw new Error('H3 context not found.')
    }
    
    return data ? h3Context.auth?.[data] : h3Context.auth
  },
)

/**
 * 注入响应上下文装饰器
 * 
 * @example
 * ```typescript
 * @Get('/custom-response')
 * async customResponse(@Response() res: H3ResponseContext) {
 *   res.statusCode = 201
 *   res.headers = { 'X-Custom': 'value' }
 *   return { message: 'custom response' }
 * }
 * ```
 */
export const Response = createParamDecorator(
  (data: keyof H3ResponseContext | undefined, ctx: ExecutionContext) => {
    const response = ctx.switchToHttp().getResponse()
    const h3Response = response.h3Response as H3ResponseContext
    
    if (!h3Response) {
      throw new Error('H3 response context not found.')
    }
    
    return data ? h3Response[data] : h3Response
  },
)

/**
 * 注入路由信息装饰器
 * 
 * @example
 * ```typescript
 * @Get('/route-info')
 * async getRouteInfo(@RouteInfo() route: H3RouteInfo) {
 *   return { route }
 * }
 * ```
 */
export const RouteInfo = createParamDecorator(
  (data: keyof H3RouteInfo | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const routeInfo = request.routeInfo as H3RouteInfo
    
    if (!routeInfo) {
      throw new Error('Route info not found.')
    }
    
    return data ? routeInfo[data] : routeInfo
  },
)

/**
 * 注入请求统计装饰器
 * 
 * @example
 * ```typescript
 * @Get('/stats')
 * async getStats(@RequestStats() stats: H3RequestStats) {
 *   return { stats }
 * }
 * ```
 */
export const RequestStats = createParamDecorator(
  (data: keyof H3RequestStats | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const stats = request.stats as H3RequestStats
    
    if (!stats) {
      throw new Error('Request stats not found.')
    }
    
    return data ? stats[data] : stats
  },
)

/**
 * 注入下一个中间件函数装饰器
 * 
 * @example
 * ```typescript
 * @Middleware('/auth')
 * async authMiddleware(@Next() next: Function) {
 *   // 认证逻辑
 *   await next()
 * }
 * ```
 */
export const Next = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.next
  },
)