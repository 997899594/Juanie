import { NestFactory } from "@nestjs/core";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AuthService } from "./auth/auth.service";
import { TrpcService } from "./trpc/trpc.service";
import { AuthMiddleware } from "./middleware/auth.middleware";
import { HttpExceptionFilter } from "./common/exceptions/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用CORS
  app.enableCors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  });

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局拦截器
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 使用cookie解析器
  app.use(cookieParser());

  // 应用认证中间件到所有路由
  const authMiddleware = app.get(AuthMiddleware);
  app.use((req: any, res: any, next: any) => {
    authMiddleware.use(req, res, next);
  });

  const trpcService = app.get(TrpcService);

  // tRPC Express适配器配置 - 使用优化的createContext
  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: trpcService.router,
      createContext: async ({ req, res }) => {
        // 从中间件中获取已验证的用户和会话信息
        const authenticatedReq = req as any;
        
        return {
          req,
          res,
          app,
          user: authenticatedReq.user || null,
          session: authenticatedReq.session ? {
            userId: authenticatedReq.session.userId,
            sessionId: authenticatedReq.session.id,
          } : null,
        };
      },
    })
  );

  await app.listen(process.env.PORT || 3000);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT || 3000}`
  );
  console.log(
    `tRPC endpoint: http://localhost:${process.env.PORT || 3000}/trpc`
  );
}
bootstrap();
