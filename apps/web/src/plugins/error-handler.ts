/**
 * Vue 全局错误处理插件
 *
 * 自动捕获 Vue 组件错误并发送到 Grafana Faro
 */

import type { App } from 'vue'
import { logError } from '../lib/observability'

export function setupErrorHandler(app: App) {
  // Vue 错误处理
  app.config.errorHandler = (err, instance, info) => {
    console.error('Vue Error:', err, info)

    // 发送到 Faro
    logError(err as Error, {
      type: 'vue-error',
      componentName: instance?.$options.name || 'Unknown',
      info,
    })
  }

  // Vue 警告处理（仅开发环境）
  if (import.meta.env.DEV) {
    app.config.warnHandler = (msg, _instance, trace) => {
      console.warn('Vue Warning:', msg, trace)
    }
  }

  // 全局未捕获错误
  window.addEventListener('error', (event) => {
    console.error('Uncaught Error:', event.error)

    logError(event.error || new Error(event.message), {
      type: 'uncaught-error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  // 全局未捕获 Promise 拒绝
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason)

    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))

    logError(error, {
      type: 'unhandled-rejection',
    })
  })
}
