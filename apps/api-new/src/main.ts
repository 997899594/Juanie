import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AuthMiddleware } from "./middleware/auth.middleware";
import { TrpcService } from "./trpc/trpc.service";

// import { HttpExceptionFilter } from "./common/exceptions/http-exception.filter";
// import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 启用CORS
  app.enableCors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:1997",
    ],
    credentials: true,
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  );

  // 全局异常过滤器 (暂时注释，因为文件不存在)
  // app.useGlobalFilters(new HttpExceptionFilter());

  // 全局拦截器 (暂时注释，因为文件不存在)
  // app.useGlobalInterceptors(new LoggingInterceptor());

  // 使用cookie解析器
  app.use(cookieParser());

  const trpcService = app.get(TrpcService);
  const authMiddleware = app.get(AuthMiddleware);

  // 等待tRPC服务初始化完成
  await trpcService.onModuleInit();

  // tRPC Express适配器配置 - 集成AuthMiddleware
  app.use(
    "/trpc",
    // 先应用认证中间件
    (req: any, res: any, next: any) => {
      authMiddleware.use(req, res, next);
    },
    createExpressMiddleware({
      router: trpcService.router,
      createContext: async ({ req, res }) => {
        // 从AuthMiddleware中获取已验证的用户和会话信息
        const authenticatedReq = req as any;

        return {
          req,
          res,
          session: authenticatedReq.session
            ? {
                userId: String(authenticatedReq.session.userId),
                sessionId: String(authenticatedReq.session.id),
              }
            : undefined,
        };
      },
    })
  );

  const port = configService.get<number>("PORT") || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`tRPC endpoint: http://localhost:${port}/trpc`);
}

bootstrap();
