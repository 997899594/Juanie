import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { DbModule } from "./db/db.module";
import { DocumentsModule } from "./documents/documents.module";
import { GitLabModule } from "./gitlab/gitlab.module";
import { TrpcModule } from "./trpc/trpc.module";
import { AuthMiddleware } from "./middleware/auth.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DbModule,
    AiModule,
    DocumentsModule,
    TrpcModule,
    AuthModule,
    GitLabModule,
  ],
  providers: [AuthMiddleware],
})
export class AppModule {}
