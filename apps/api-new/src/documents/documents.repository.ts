import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PG_CONNECTION } from '../db/drizzle.provider';
import { documents } from '../db/schema';
import type { InsertDocument, SelectDocument } from '../db/schema';

@Injectable()
export class DocumentsRepository {
  constructor(
    @Inject(PG_CONNECTION) private readonly db: any
  ) {}

  async create(document: InsertDocument): Promise<SelectDocument> {
    const [result] = await this.db.insert(documents).values(document).returning();
    return result;
  }

  async findById(id: number): Promise<SelectDocument | null> {
    const [result] = await this.db.select().from(documents).where(eq(documents.id, id));
    return result || null;
  }

  async findAll(): Promise<SelectDocument[]> {
    return this.db.select().from(documents);
  }
}