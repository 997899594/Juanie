/**
 * tRPC Playground 面板
 * 提供 API 调试和测试界面
 *
 * 注意：trpc-playground 包存在兼容性问题，暂时禁用
 * 可以使用其他工具如 Postman 或直接调用 API 进行测试
 */
/**
 * tRPC Panel 页面
 * 需要登录（见 plugins/auth.ts 对 /panel/** 的保护）
 */
import { defineEventHandler, getRequestURL, setHeader } from 'h3'
import { renderTrpcPanel } from 'trpc-panel'
import { appRouter } from '../src/routers'

export default defineEventHandler((event) => {
  const { protocol, host } = getRequestURL(event)
  const url = `${protocol}//${host}/trpc`

  const html = renderTrpcPanel(appRouter, {
    url,
    // 如你的 tRPC 配置开启了 superjson，这里设置匹配；否则可移除
    transformer: 'superjson',
  })

  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  return html
})
