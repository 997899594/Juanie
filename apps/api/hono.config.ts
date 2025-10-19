export default {
  port: Number(process.env.PORT) || 3001,
  hostname: process.env.HOSTNAME || "localhost",

  // 生产环境优化
  ...(process.env.NODE_ENV === "production" && {
    // 启用 HTTP/2
    http2: true,
    // 启用压缩
    compression: true,
    // 设置更严格的安全头
    security: {
      hsts: true,
      noSniff: true,
      xssFilter: true,
      referrerPolicy: "strict-origin-when-cross-origin",
    },
  }),

  // 开发环境配置
  ...(process.env.NODE_ENV === "development" && {
    // 启用详细日志
    verbose: true,
    // 热重载
    watch: true,
  }),
};
