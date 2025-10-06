// /openapi.json 路由：返回基于 tRPC 路由动态生成的 OpenAPI 文档
import { defineEventHandler, getRequestURL, setHeader } from 'h3'
import { buildOpenApiDocument } from '@/openapi'

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const baseUrl = `${url.protocol}//${url.host}`

  const doc = buildOpenApiDocument(baseUrl)

  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return doc
})
