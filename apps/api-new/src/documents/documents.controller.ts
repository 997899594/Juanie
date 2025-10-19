import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { SelectDocument } from "../db/schema";
import { CreateDocumentInput } from "../schemas/document.schema";
import { DocumentsService } from "./documents.service";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async create(
    @Body() createDocumentDto: CreateDocumentInput
  ): Promise<SelectDocument> {
    return this.documentsService.createWithEmbedding(createDocumentDto);
  }

  @Get()
  async findAll(): Promise<SelectDocument[]> {
    return this.documentsService.findAll();
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseIntPipe) id: number
  ): Promise<SelectDocument | null> {
    return this.documentsService.findById(id);
  }
}
