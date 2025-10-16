import type { Type } from '@nestjs/common'
import { getNestApp } from '../plugins/nestjs'

/**
 * 获取 NestJS 服务实例
 * @param serviceClass 服务类
 * @returns 服务实例
 */
export async function getService<T>(serviceClass: Type<T>): Promise<T> {
  console.log('🔍 [DEBUG] getService called for:', serviceClass.name)

  try {
    const app = getNestApp()
    console.log('🔍 [DEBUG] Got NestJS app:', app)

    const service = app.get<T>(serviceClass)
    console.log('🔍 [DEBUG] Got service instance:', service)

    return service
  } catch (error) {
    console.error('❌ [DEBUG] Failed to get service:', error)
    throw error
  }
}
