import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GitLabModule } from "../gitlab/gitlab.module";
import { DocumentsModule } from "../documents/documents.module";
import { TrpcService } from "./trpc.service";

@Module({
  imports: [AuthModule, GitLabModule, DocumentsModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
