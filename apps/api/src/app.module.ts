import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./config/configuration";
import { DrizzleModule } from "./drizzle/drizzle.module";
import { AuthModule } from "./modules/auth/auth.module";
import { GitModule } from "./modules/git/git.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // 忽略.env文件，使用Nitro加载的环境变量
      load: [configuration],
      cache: true,
      expandVariables: true,
    }),
    DrizzleModule,
    AuthModule,
    GitModule,
    HealthModule,
  ],
})
export class AppModule {}
