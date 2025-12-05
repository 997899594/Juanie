/**
 * 前端可观测性配置 - Grafana Faro
 *
 * 自动收集：
 * - 错误和异常
 * - 性能指标（Web Vitals）
 * - 用户会话
 * - 控制台日志
 * - 网络请求
 */

import {
  type Faro,
  type FaroConfig,
  getWebInstrumentations,
  initializeFaro,
} from '@grafana/faro-web-sdk'

let faro: Faro | null = null

/**
 * 初始化 Grafana Faro SDK
 */
export function setupObservability(): Faro | null {
  // 只在生产环境或明确启用时初始化
  const isEnabled = import.meta.env.VITE_OBSERVABILITY_ENABLED === 'true' || import.meta.env.PROD

  if (!isEnabled) {
    console.log('⏭️  前端可观测性已禁用（开发环境）')
    return null
  }

  const collectorUrl = import.meta.env.VITE_FARO_COLLECTOR_URL
  if (!collectorUrl) {
    console.warn('⚠️  未配置 VITE_FARO_COLLECTOR_URL，跳过前端可观测性初始化')
    return null
  }

  try {
    const config: FaroConfig = {
      url: collectorUrl,
      app: {
        name: 'juanie-web',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        environment: import.meta.env.MODE || 'development',
      },
      instrumentations: [
        // 自动收集 Web Vitals、错误、控制台日志等
        ...getWebInstrumentations({
          captureConsole: true,
          captureConsoleDisabledLevels: ['debug', 'trace'], // 不捕获 debug 和 trace
        }),
      ],
      // 会话追踪
      sessionTracking: {
        enabled: true,
        persistent: true,
      },
      // 用户信息（可选）
      user: {
        // 可以在登录后设置用户信息
        // id: userId,
        // email: userEmail,
        // username: username,
      },
      // 忽略特定错误
      ignoreErrors: [
        // 忽略浏览器扩展错误
        /chrome-extension/,
        /moz-extension/,
        // 忽略第三方脚本错误
        /^Script error\.?$/,
        /^Javascript error: Script error\.? on line 0$/,
      ],
      // 采样率（1.0 = 100%）
      sessionSampleRate: 1.0,
    }

    faro = initializeFaro(config)
    console.log('✅ Grafana Faro 已启动')
    console.log(`📊 收集器: ${collectorUrl}`)

    return faro
  } catch (error) {
    console.error('❌ Grafana Faro 初始化失败:', error)
    return null
  }
}

/**
 * 获取 Faro 实例
 */
export function getFaro(): Faro | null {
  return faro
}

/**
 * 设置用户信息
 */
export function setUser(userId: string, email?: string, username?: string) {
  if (faro) {
    faro.api.setUser({
      id: userId,
      email,
      username,
    })
  }
}

/**
 * 清除用户信息（登出时）
 */
export function clearUser() {
  if (faro) {
    faro.api.resetUser()
  }
}

/**
 * 手动记录错误
 */
export function logError(error: Error, context?: Record<string, unknown>) {
  if (faro) {
    faro.api.pushError(error, {
      context,
    })
  } else {
    console.error('Error:', error, context)
  }
}

/**
 * 手动记录事件
 */
export function logEvent(name: string, attributes?: Record<string, string | number | boolean>) {
  if (faro) {
    faro.api.pushEvent(name, attributes)
  } else {
    console.log('Event:', name, attributes)
  }
}

/**
 * 手动记录日志
 */
export function logMessage(
  message: string,
  level: 'log' | 'info' | 'warn' | 'error' = 'info',
  context?: Record<string, unknown>,
) {
  if (faro) {
    faro.api.pushLog([message], {
      level,
      context,
    })
  } else {
    console[level](message, context)
  }
}

/**
 * 手动记录性能指标
 */
export function recordMeasurement(
  name: string,
  value: number,
  attributes?: Record<string, string>,
) {
  if (faro) {
    faro.api.pushMeasurement({
      type: name,
      value,
      values: attributes,
    })
  }
}

/**
 * 创建自定义 Span（用于追踪异步操作）
 */
export function startSpan(name: string, attributes?: Record<string, string>) {
  if (faro?.api.getOTEL) {
    const tracer = faro.api.getOTEL()?.trace.getTracer('juanie-web')
    return tracer?.startSpan(name, {
      attributes,
    })
  }
  return null
}
