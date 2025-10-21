import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { DbModule } from "../db/db.module";
import { DocumentsRepository } from "./documents.repository";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [DbModule, AiModule],
  providers: [DocumentsService, DocumentsRepository],
  exports: [DocumentsService],
})
export class DocumentsModule {}
