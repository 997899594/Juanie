import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray, sql, desc, asc } from 'drizzle-orm';
import { PG_CONNECTION } from '../db/drizzle.provider';
import { documents } from '../db/schema';
import type { InsertDocument, SelectDocument } from '../db/schema';
import type { ListDocumentsInput } from '../schemas/document.schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

@Injectable()
export class DocumentsRepository {
  constructor(@Inject(PG_CONNECTION) private readonly db: PostgresJsDatabase<typeof import('../db/schema')>) {}

  async create(data: Omit<InsertDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<SelectDocument> {
    const [document] = await this.db
      .insert(documents)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    return document;
  }

  async findById(id: number): Promise<SelectDocument | null> {
    const [document] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    
    return document || null;
  }

  async findAll(input?: ListDocumentsInput): Promise<SelectDocument[]> {
    const db = this.db;
    let query = db.select().from(documents);

    // 应用过滤条件
    if (input?.tags && input.tags.length > 0) {
      // 使用 SQL 函数检查数组交集
      query = query.where(
        sql`${documents.tags} && ${JSON.stringify(input.tags)}`
      ) as typeof query;
    }

    // 应用排序
    if (input?.sortBy) {
      const sortField = input.sortBy === 'createdAt' ? documents.createdAt :
                       input.sortBy === 'updatedAt' ? documents.updatedAt :
                       input.sortBy === 'title' ? documents.title :
                       documents.id;
      
      query = (input.sortOrder === 'desc' ? 
        query.orderBy(desc(sortField)) : 
        query.orderBy(asc(sortField))) as typeof query;
    } else {
      // 默认按创建时间倒序
      query = query.orderBy(desc(documents.createdAt)) as typeof query;
    }

    // 应用分页
    if (input?.limit) {
      query = query.limit(input.limit) as typeof query;
    }
    if (input?.offset) {
      query = query.offset(input.offset) as typeof query;
    }

    return await query;
  }

  async update(id: number, data: Partial<Omit<InsertDocument, 'id' | 'createdAt'>>): Promise<SelectDocument> {
    const [document] = await this.db
      .update(documents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();
    
    if (!document) {
      throw new Error(`Document with id ${id} not found`);
    }
    
    return document;
  }

  async delete(id: number): Promise<void> {
    const result = await this.db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Document with id ${id} not found`);
    }
  }

  async searchBySimilarity(
    queryEmbedding: number[],
    similarity: number = 0.7,
    limit: number = 10,
    offset: number = 0
  ): Promise<SelectDocument[]> {
    // 使用向量相似度搜索（需要数据库支持向量操作）
    // 这里使用简化的实现，实际项目中可能需要使用 pgvector 等扩展
    const embeddingStr = JSON.stringify(queryEmbedding);
    
    return this.db
      .select()
      .from(documents)
      .where(
        sql`1 - (${documents.embedding} <=> ${JSON.stringify(queryEmbedding)}) > ${similarity}`
      )
      .orderBy(
        sql`${documents.embedding} <=> ${JSON.stringify(queryEmbedding)}`
      )
      .limit(limit)
      .offset(offset);
  }

  async bulkDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    const result = await this.db
      .delete(documents)
      .where(inArray(documents.id, ids))
      .returning();
    
    return result.length;
  }

  async bulkUpdate(
    ids: number[], 
    updates: { tags?: string[]; metadata?: Record<string, any> }
  ): Promise<number> {
    if (ids.length === 0) return 0;
    
    const result = await this.db
      .update(documents)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(inArray(documents.id, ids))
      .returning();
    
    return result.length;
  }

  async getStats(): Promise<{
    total: number;
    totalWithEmbedding: number;
    averageLength: number;
    tagCount: number;
  }> {
    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)`,
        totalWithEmbedding: sql<number>`count(${documents.embedding})`,
        averageLength: sql<number>`avg(length(${documents.content}))`,
        tagCount: sql<number>`count(distinct unnest(${documents.tags}))`,
      })
      .from(documents);
    
    return {
      total: Number(stats.total),
      totalWithEmbedding: Number(stats.totalWithEmbedding),
      averageLength: Number(stats.averageLength) || 0,
      tagCount: Number(stats.tagCount),
    };
  }
}