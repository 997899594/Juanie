import { getService } from '@/lib/utils/nest-service'
import { TestService } from '@/modules/test/test.service'

export default defineEventHandler(async (event) => {
  const testService = getService(TestService)
  return await testService.runComprehensiveTests()
})
