import { defineEventHandler, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return { status: 'ok', message: 'pong', timestamp: new Date().toISOString() }
})
