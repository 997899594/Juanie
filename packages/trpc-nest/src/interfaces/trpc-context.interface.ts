/**
 * tRPC 基础上下文接口
 */
export interface TrpcContext {
  /**
   * 请求对象
   */
  req?: any
  
  /**
   * 响应对象
   */
  res?: any
  
  /**
   * 用户信息
   */
  user?: any
  
  /**
   * 会话信息
   */
  session?: any
  
  /**
   * 其他自定义属性
   */
  [key: string]: any
}

/**
 * tRPC 上下文创建器接口
 */
export interface TrpcContextCreator<T = TrpcContext> {
  /**
   * 创建上下文
   */
  create(req: any, res?: any): T | Promise<T>
}

/**
 * tRPC 中间件上下文
 */
export interface TrpcMiddlewareContext extends TrpcContext {
  /**
   * 下一个中间件函数
   */
  next: () => Promise<any>
  
  /**
   * 中间件元数据
   */
  meta?: {
    procedure?: string
    router?: string
    [key: string]: any
  }
}