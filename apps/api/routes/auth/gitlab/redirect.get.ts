import { defineEventHandler, sendRedirect, setCookie } from 'h3'
import { getAppContainer } from '../../../src/nest'

export default defineEventHandler(async (event) => {
  const { authService } = getAppContainer()

  const { url, state, codeVerifier } = await authService.createGitLabAuthorizationURL()

  setCookie(event, 'oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 600,
    path: '/',
  })

  setCookie(event, 'oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 600,
    path: '/',
  })

  return sendRedirect(event, url.toString(), 302)
})
