import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { AuthModule } from "../auth/auth.module";
import { TrpcService } from "./trpc.service";

@Module({
  imports: [DocumentsModule, AuthModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
