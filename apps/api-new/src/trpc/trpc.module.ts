import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DocumentsModule } from "../documents/documents.module";
import { GitLabModule } from "../gitlab/gitlab.module";
import { TrpcService } from "./trpc.service";
import { AuthRouter } from "./routers/auth.decorator.router";
import { GitLabRouter } from "./routers/gitlab.decorator.router";
import { DocumentsRouter } from "./routers/documents.decorator.router";

@Module({
  imports: [DocumentsModule, AuthModule, GitLabModule],
  providers: [
    TrpcService,
    AuthRouter,
    GitLabRouter,
    DocumentsRouter,
  ],
  exports: [TrpcService],
})
export class TrpcModule {}
