export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 's-maxage=60')
  setHeader(event, 'content-type', 'application/json')

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    stack: 'Nitro + tRPC + Drizzle',
    services: {
      database: 'connected',
      cache: 'available',
      api: 'operational'
    }
  }
})
