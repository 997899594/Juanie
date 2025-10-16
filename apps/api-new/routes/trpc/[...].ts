import { defineEventHandler, setHeader, setResponseStatus } from 'h3'
import { createContext, testRouter } from '~/trpc/test'

export default defineEventHandler(async (event) => {
  // 设置 CORS 头
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // 处理 OPTIONS 请求
  if (event.node.req.method === 'OPTIONS') {
    setResponseStatus(event, 200)
    return ''
  }

  try {
    // 简单的路径解析
    const url = new URL(event.node.req.url!, `http://${event.node.req.headers.host}`)
    const path = url.pathname.replace('/trpc/', '')

    // 创建上下文
    const ctx = await createContext()

    // 直接调用对应的过程
    if (path === 'hello') {
      const query = Object.fromEntries(url.searchParams.entries())
      const input = query.input ? JSON.parse(query.input) : {}
      const result = await testRouter.createCaller(ctx).hello(input)
      return { result }
    }

    if (path === 'getUsers') {
      const result = await testRouter.createCaller(ctx).getUsers()
      return { result }
    }

    // 未找到路由
    setResponseStatus(event, 404)
    return { error: true, message: `路由 ${path} 不存在` }
  } catch (error) {
    console.error('tRPC 错误:', error)
    setResponseStatus(event, 500)
    return {
      error: true,
      message: '服务器错误',
      details: error instanceof Error ? error.message : String(error),
    }
  }
})
