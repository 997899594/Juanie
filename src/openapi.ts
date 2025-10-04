import { generateOpenApiDocument } from 'trpc-to-openapi'
import { appRouter } from './routers/index.js'

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'Juanie API',
  version: '1.0.0',
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://api.juanie.com' 
    : 'http://localhost:3000',
  description: `
# Juanie API 文档

现代化的全栈应用API，基于tRPC构建，提供端到端类型安全。

## 特性

- 🔒 **类型安全**: 基于TypeScript和Zod的端到端类型安全
- ⚡ **高性能**: 使用Nitro运行时，支持边缘计算
- 🛡️ **安全可靠**: 内置认证、授权和数据验证
- 📊 **可观测性**: 完整的日志、监控和性能追踪
- 🔄 **实时更新**: 支持WebSocket和Server-Sent Events

## 认证

API使用JWT Bearer Token进行认证。在请求头中包含：

\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## 错误处理

所有错误响应遵循统一格式：

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "data": {}
  }
}
\`\`\`

## 速率限制

- 未认证用户: 100 请求/小时
- 认证用户: 1000 请求/小时
- 高级用户: 10000 请求/小时
  `,
  docsUrl: 'https://trpc.io',
  tags: ['健康检查', '系统监控', '认证授权'],
})

// 导出生成函数供路由使用
export { generateOpenApiDocument }
