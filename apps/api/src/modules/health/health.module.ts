import { Module } from "@nestjs/common";
import { DrizzleModule } from "../../drizzle/drizzle.module";
import { HealthService } from "./services/health.service";

/**
 * 健康检查模块
 * 提供系统健康状态检查功能
 */
@Module({
  imports: [DrizzleModule],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
