import { NestFactory } from "@nestjs/core";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { TrpcService } from "./trpc/trpc.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 添加 cookie-parser 中间件
  app.use(cookieParser());

  const trpcService = app.get(TrpcService);

  // 配置CORS，允许前端域名访问
  app.enableCors({
    origin: [
      "http://localhost:1997", // 前端开发服务器
      "http://localhost:1998", // 前端开发服务器备用端口
      "http://localhost:5173", // Vite默认端口
      "http://192.168.100.46:1997", // 网络IP访问
    ],
    credentials: true, // 允许携带Cookie
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-trpc-source"],
  });

  // tRPC Express适配器配置 - 需要单独配置CORS
  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: trpcService.router,
      createContext: ({ req, res }) => {
        console.log("=== tRPC createContext 调试信息 ===");
        console.log("req.cookies:", req.cookies);
        console.log("req.headers.cookie:", req.headers.cookie);
        return { req, res };
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
