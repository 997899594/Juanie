import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  return {
    message: 'Welcome to Juanie API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      trpc: '/trpc',
    },
  }
})
