import { createError, defineEventHandler, getCookie, setHeader } from 'h3'
import { getNestApp } from '@/index'

export default defineEventHandler(async (event) => {
  const app = await getNestApp()
  const { SessionService } = await import('@/modules/auth/services/session.service')
  const sessionService = app.get(SessionService)

  const sessionToken = getCookie(event, 'session_token')

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'No session token',
    })
  }

  try {
    const user = await sessionService.validateSession(sessionToken)

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid session',
      })
    }

    setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Session validation failed',
    })
  }
})
