import { defineEventHandler, getCookie } from 'h3'
import { getAppContainer } from '../../../src/nest'

export default defineEventHandler(async (event) => {
  const { authService, databaseService } = getAppContainer()

  try {
    const sessionId = getCookie(event, 'session')

    if (!sessionId) {
      return { loggedIn: false, user: null }
    }

    const sessionData = await authService.validateSession(sessionId)

    if (!sessionData) {
      return { loggedIn: false, user: null }
    }

    const user = await databaseService.getUserById(sessionData.userId)

    if (!user) {
      await authService.destroySession(sessionId)
      return { loggedIn: false, user: null }
    }

    return {
      loggedIn: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    }
  } catch (error) {
    console.error('Session validation error:', error)
    return { loggedIn: false, user: null }
  }
})
