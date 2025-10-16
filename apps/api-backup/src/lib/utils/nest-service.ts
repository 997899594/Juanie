/**
 * NestJS 服务获取工具
 * 使用官方推荐的方式获取服务实例
 */

import type { Type } from '@nestjs/common'
import { getNestApp } from '../../../plugins/nestjs'

/**
 * 获取 NestJS 服务实例
 * @param serviceClass 服务类
 * @returns 服务实例
 */
export function getService<T>(serviceClass: Type<T>): T {
  const app = getNestApp()
  return app.get<T>(serviceClass)
}
