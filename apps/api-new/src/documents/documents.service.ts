import { Injectable } from '@nestjs/common';
import { DocumentsRepository } from './documents.repository';
import { AiService } from '../ai/ai.service';
import { 
  createDocumentSchema,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  type ListDocumentsInput,
  type SearchDocumentsInput,
  type DocumentResponse
} from '../schemas/document.schema';
import type { SelectDocument } from '../db/schema';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly aiService: AiService,
  ) {}

  async createWithEmbedding(input: CreateDocumentInput): Promise<DocumentResponse> {
    // Zod 验证在 tRPC 层已完成，这里可以直接使用
    const embedding = await this.aiService.generateEmbedding(input.content);
    
    const document = await this.documentsRepository.create({
      content: input.content,
      title: input.title || null,
      tags: input.tags || [],
      metadata: input.metadata || null,
      embedding: JSON.stringify(embedding),
    });

    return this.mapToResponse(document);
  }

  async findAll(input?: ListDocumentsInput): Promise<DocumentResponse[]> {
    const documents = await this.documentsRepository.findAll(input);
    return documents.map(doc => this.mapToResponse(doc));
  }

  async findById(id: number): Promise<DocumentResponse | null> {
    const document = await this.documentsRepository.findById(id);
    return document ? this.mapToResponse(document) : null;
  }

  async update(input: UpdateDocumentInput): Promise<DocumentResponse> {
    const updateData: Partial<SelectDocument> = {};
    
    if (input.content !== undefined) {
      updateData.content = input.content;
      // 如果内容更新，重新生成 embedding
      updateData.embedding = JSON.stringify(
        await this.aiService.generateEmbedding(input.content)
      );
    }
    
    if (input.title !== undefined) updateData.title = input.title;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const document = await this.documentsRepository.update(input.id, updateData);
    return this.mapToResponse(document);
  }

  async delete(id: number): Promise<{ success: boolean }> {
    await this.documentsRepository.delete(id);
    return { success: true };
  }

  async search(input: SearchDocumentsInput): Promise<DocumentResponse[]> {
    const queryEmbedding = await this.aiService.generateEmbedding(input.query);
    const documents = await this.documentsRepository.searchBySimilarity(
      queryEmbedding,
      input.similarity,
      input.limit,
      input.offset
    );
    return documents.map(doc => this.mapToResponse(doc));
  }

  async bulkDelete(ids: number[]): Promise<{ deletedCount: number }> {
    const deletedCount = await this.documentsRepository.bulkDelete(ids);
    return { deletedCount };
  }

  async bulkUpdate(ids: number[], updates: { tags?: string[]; metadata?: Record<string, any> }): Promise<{ updatedCount: number }> {
    const updatedCount = await this.documentsRepository.bulkUpdate(ids, updates);
    return { updatedCount };
  }

  async getStats(): Promise<{ total: number; totalWithEmbedding: number; averageLength: number; tagCount: number }> {
    return this.documentsRepository.getStats();
  }

  private mapToResponse(document: SelectDocument): DocumentResponse {
    return {
      id: document.id,
      content: document.content,
      title: document.title,
      tags: document.tags || [],
      metadata: document.metadata,
      embedding: document.embedding,
      createdAt: document.createdAt || new Date(),
      updatedAt: document.updatedAt || new Date(),
    };
  }
}