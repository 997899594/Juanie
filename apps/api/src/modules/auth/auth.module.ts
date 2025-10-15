import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DrizzleModule } from "../../drizzle/drizzle.module"; // 更新引用
import { AuthService } from "./services/auth.service";
import { SessionService } from "./services/session.service";

@Module({
  imports: [
    ConfigModule, // 显式导入 ConfigModule
    DrizzleModule
  ],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
