import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineEventHandler, getRequestURL, setHeader } from 'h3'

// 在模块加载时读取并缓�?package.json，避免每次请求都读文�?
const pkg = (() => {
  const candidates = [
    resolve(process.cwd(), 'package.json'),
    resolve(process.cwd(), 'apps', 'api', 'package.json'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, 'utf-8'))
      } catch {
        // ignore parse error and try next candidate
      }
    }
  }
  // 回退默认值（仅在找不到或解析失败时使用）
  return { name: 'Juanie API', version: '1.0.0', description: 'API Service' }
})()

export default defineEventHandler(async (event) => {
  // 设置响应�?
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=300')

  const baseUrl = getRequestURL(event).origin

  return {
    name: pkg.name ?? 'Juanie API',
    version: pkg.version ?? '1.0.0',
    description: pkg.description ?? 'Juanie 服务入口（Nitro + tRPC + NestJS）',
    status: 'ok',
    timestamp: new Date().toISOString(),
    links: {
      openapi: `${baseUrl}/docs/openapi.json`, // 修正路径
      docs: `${baseUrl}/docs/scalar`, // 修正路径
      trpc: `${baseUrl}/trpc`,
      health: `${baseUrl}/api/health`,
      auth: {
        github: `${baseUrl}/auth/github/redirect`,
        gitlab: `${baseUrl}/auth/gitlab/redirect`,
        me: `${baseUrl}/auth/session/me`,
        logout: `${baseUrl}/auth/session/destroy`,
      },
    },
  }
})
