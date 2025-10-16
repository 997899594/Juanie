import { ConfigService } from '@nestjs/config'
import { getService } from '@/lib/utils/nest-service'
import { TestService } from '@/modules/test/test.service'

export default defineEventHandler(async (event) => {
  const testService = getService(TestService)
  const configService = getService(ConfigService)

  return await testService.testConfigService(configService)
})
