/**
 * 🚀 Juanie AI - 主应用启动文件
 * 2025年最前沿的AI原生DevOps平台
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SecurityHeadersMiddleware } from './security/middleware/security-headers.middleware';
import { ZeroTrustGuard } from './security/guards/zero-trust.guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // 创建应用实例
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 安全中间件
  app.use(new SecurityHeadersMiddleware().use);

  // 零信任安全守卫
  const zeroTrustGuard = app.get(ZeroTrustGuard);
  app.useGlobalGuards(zeroTrustGuard);

  // 性能优化配置
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  
  // 启动应用
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Juanie AI 应用已启动`);
  logger.log(`🌐 服务地址: http://localhost:${port}`);
  logger.log(`🔧 运行环境: ${nodeEnv}`);
  logger.log(`📊 监控端点: http://localhost:${port}/api/performance/health`);
  
  if (nodeEnv === 'development') {
    logger.log(`🔍 调试模式已启用`);
  }

  // 优雅关闭处理
  process.on('SIGTERM', async () => {
    logger.log('🛑 收到SIGTERM信号，开始优雅关闭...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('🛑 收到SIGINT信号，开始优雅关闭...');
    await app.close();
    process.exit(0);
  });
}

// 启动应用
bootstrap().catch((error) => {
  console.error('❌ 应用启动失败:', error);
  process.exit(1);
});