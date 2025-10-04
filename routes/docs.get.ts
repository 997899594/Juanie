import { openApiDocument } from '../src/openapi.js'

export default defineEventHandler(async (event) => {
  // 设置缓存和CORS头
  setHeader(event, 'Cache-Control', 'public, max-age=300') // 5分钟缓存
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')

  const url = getRequestURL(event)
  
  // 检查Accept头，如果明确要求JSON则返回OpenAPI规范
  const acceptHeader = getHeader(event, 'accept') || ''
  const wantsJson = acceptHeader.includes('application/json') || 
                   url.searchParams.get('format') === 'json'

  if (wantsJson) {
    // 动态更新baseUrl以匹配当前请求
    const dynamicDocument = {
      ...openApiDocument,
      servers: [
        {
          url: url.origin,
          description: process.env.NODE_ENV === 'production' ? '生产环境' : '开发环境'
        }
      ]
    }
    
    setHeader(event, 'Content-Type', 'application/json')
    return dynamicDocument
  }

  // 默认重定向到Scalar文档页面
  return sendRedirect(event, '/scalar-docs', 302)
})
