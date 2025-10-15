import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { GitService } from '@/modules/git/services/git.service'
import { getNestApp } from '@/index'

export default defineEventHandler(async (event) => {
  try {
    const app = await getNestApp()
    const gitService = app.get(GitService)

    const provider = getRouterParam(event, 'provider')
    if (!provider || !['github', 'gitlab'].includes(provider)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid provider',
      })
    }

    const payload = await readBody(event)

    // 处理 webhook 事件
    await gitService.webhooks.processWebhook(
      provider.toUpperCase(),
      payload,
      ((Array.isArray(event.node.req.headers['x-hub-signature-256'])
        ? event.node.req.headers['x-hub-signature-256'][0]
        : event.node.req.headers['x-hub-signature-256']) ??
        '') ||
        ((Array.isArray(event.node.req.headers['x-gitlab-token'])
          ? event.node.req.headers['x-gitlab-token'][0]
          : event.node.req.headers['x-gitlab-token']) ??
          ''),
    )

    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      statusMessage: msg,
    })
  }
})
