import { defineEventHandler, sendRedirect } from 'h3'
export default defineEventHandler((event) => {
  return sendRedirect(event, '/openapi.json', 302)
})
