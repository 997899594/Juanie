import { getService } from '@/lib/utils/nest-service'
import { GitService } from '@/modules/git/services/git.service'

export default defineEventHandler(async (event) => {
  const gitService = getService(GitService)
  return await gitService.handleWebhook(event)
})
