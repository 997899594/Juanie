// 顶层模块
import { defineEventHandler, getHeader, getRequestURL, sendRedirect, setHeader } from 'h3'
import { buildOpenApiDocument } from '../src/openapi'

export default defineEventHandler((event) => {
  const accept = getHeader(event, 'accept') || ''
  const url = event.node.req.url || ''
  const wantsJson = accept.includes('application/json') || url.includes('format=json')

  if (wantsJson) {
    const { protocol, host } = getRequestURL(event)
    const baseUrl = `${protocol}//${host}`
    setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    const doc = buildOpenApiDocument(baseUrl)
    return doc
  }

  // 将非 JSON 请求重定向到文档 UI（根据你的实际页面调整路径）
  return sendRedirect(event, '/scalar-docs', 302)
})
