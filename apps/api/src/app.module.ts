import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DrizzleModule } from "./drizzle/drizzle.module";
import { AuthModule } from "./modules/auth/auth.module";
import { GitModule } from "./modules/git/git.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule,
    AuthModule,
    GitModule,
    HealthModule,
  ],
})
export class AppModule {}
