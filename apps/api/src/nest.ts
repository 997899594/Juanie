import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

let nestApp: INestApplicationContext | null = null;

export interface AppContainer {
  nestApp: INestApplicationContext;
}

export async function initNestAppContainer(): Promise<AppContainer> {
  if (nestApp) {
    return { nestApp };
  }

  // 创建应用上下文（不启动 HTTP 服务器）
  nestApp = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  // 启用关闭钩子
  nestApp.enableShutdownHooks();

  return { nestApp };
}

export async function getNestApp(): Promise<INestApplicationContext> {
  if (!nestApp) {
    const container = await initNestAppContainer();
    return container.nestApp;
  }
  return nestApp;
}

export async function getAppContainer(): Promise<AppContainer> {
  const nestApp = await getNestApp();
  return { nestApp };
}

// 优雅关闭
export async function closeNestApp(): Promise<void> {
  if (nestApp) {
    await nestApp.close();
    nestApp = null;
  }
}
