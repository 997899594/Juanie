import { generateOpenApiDocument } from 'trpc-to-openapi'
import { appRouter } from './routers'

// 基于 tRPC 路由动态生成 OpenAPI 文档（保持与过程同步）
export const buildOpenApiDocument = (baseUrl: string) => {
  const doc = generateOpenApiDocument(appRouter, {
    title: 'Juanie API',
    version: '1.0.0',
    baseUrl,
    description: 'Public API for Juanie services',
  })

  return {
    ...doc,
    components: {
      ...(doc.components ?? {}),
      securitySchemes: {
        ...(doc.components?.securitySchemes ?? {}),
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Use Authorization: Bearer <token>',
        },
      },
    },
    // 不在此处设置全局 security，避免影响公共端点；每个过程是否需要鉴权由 meta.openapi.protect 控制
    security: doc.security ?? [],
  }
}

// 保留原导出（可用于其他脚本）
export { generateOpenApiDocument }
