import { getService } from '@/lib/utils/nest-service'
import { AuthService } from '@/modules/auth/services/auth.service'

export default defineEventHandler(async (event) => {
  const authService = getService(AuthService)
  return await authService.getCurrentUser(event)
})
