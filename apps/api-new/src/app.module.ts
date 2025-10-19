import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./ai/ai.module";
import { DbModule } from "./db/db.module";
import { DocumentsModule } from "./documents/documents.module";
import { TrpcModule } from "./trpc/trpc.module";
import { AuthModule } from "./auth/auth.module";

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
  ],
})
export class AppModule {}
