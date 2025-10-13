import { defineEventHandler, getCookie, setCookie } from 'h3'
import { getAppContainer } from '../../../src/nest'

export default defineEventHandler(async (event) => {
  const { authService } = getAppContainer()

  try {
    const sessionId = getCookie(event, 'session')

    if (sessionId) {
      await authService.destroySession(sessionId)
    }

    // 清除会话 Cookie
    setCookie(event, 'session', '', {
      maxAge: 0,
      path: '/',
    })

    return { success: true, message: '登出成功' }
  } catch (error) {
    console.error('Logout error:', error)
    return { success: false, message: '登出失败' }
  }
})
