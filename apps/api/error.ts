/**
 * Nitro 错误处理器
 * 处理应用程序中的未捕获错误
 */
export default function (error: any, event: any) {
  // 记录错误
  console.error('Nitro Error:', {
    message: error.message,
    stack: error.stack,
    url: event.node.req.url,
    method: event.node.req.method,
    timestamp: new Date().toISOString(),
  })

  // 设置响应状态码
  const statusCode = error.statusCode || 500
  event.node.res.statusCode = statusCode

  // 返回错误响应
  return {
    error: {
      statusCode,
      statusMessage: error.statusMessage || 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
      }),
    },
    timestamp: new Date().toISOString(),
  }
}
