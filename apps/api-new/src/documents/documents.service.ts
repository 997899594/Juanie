import { Injectable } from '@nestjs/common';
import { DocumentsRepository } from './documents.repository';
import { AiService } from '../ai/ai.service';
import { createDocumentSchema } from '../schemas/document.schema';
import type { CreateDocumentInput } from '../schemas/document.schema';
import type { SelectDocument } from '../db/schema';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly aiService: AiService,
  ) {}

  async createWithEmbedding(input: CreateDocumentInput): Promise<SelectDocument> {
    // 验证输入
    const validatedInput = createDocumentSchema.parse(input);
    
    const embedding = await this.aiService.generateEmbedding(input.content);
    
    return this.documentsRepository.create({
      content: input.content,
      embedding: JSON.stringify(embedding), // 将数组转换为 JSON 字符串
    });
  }

  async findById(id: number): Promise<SelectDocument | null> {
    return this.documentsRepository.findById(id);
  }

  async findAll(): Promise<SelectDocument[]> {
    return this.documentsRepository.findAll();
  }
}