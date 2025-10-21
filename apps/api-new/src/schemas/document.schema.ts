import { z } from 'zod';
import { idSchema, paginationSchema, sortSchema, searchSchema } from './common.schema';

// 创建文档
export const createDocumentSchema = z.object({
  content: z.string().min(1, 'Content must not be empty').max(50000, 'Content too long'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  tags: z.array(z.string()).max(10, 'Too many tags').optional(),
  metadata: z.record(z.any()).optional(),
});

// 更新文档
export const updateDocumentSchema = z.object({
  id: z.number().int(),
  content: z.string().min(1, 'Content must not be empty').max(50000, 'Content too long').optional(),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  tags: z.array(z.string()).max(10, 'Too many tags').optional(),
  metadata: z.record(z.any()).optional(),
});

// 获取文档
export const getDocumentSchema = idSchema;

// 删除文档
export const deleteDocumentSchema = idSchema;

// 文档列表查询
export const listDocumentsSchema = z.object({
  ...paginationSchema.shape,
  ...sortSchema.shape,
  ...searchSchema.shape,
  tags: z.array(z.string()).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

// 文档搜索
export const searchDocumentsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  ...paginationSchema.shape,
  similarity: z.number().min(0).max(1).default(0.7),
});

// 文档响应
export const documentResponseSchema = z.object({
  id: z.number().int(),
  content: z.string(),
  title: z.string().nullable(),
  tags: z.array(z.string()),
  metadata: z.record(z.any()).nullable(),
  embedding: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// 文档统计
export const documentStatsSchema = z.object({
  total: z.number().int(),
  totalWithEmbedding: z.number().int(),
  averageLength: z.number(),
  tagCount: z.number().int(),
});

// 批量操作
export const bulkDeleteDocumentsSchema = z.object({
  ids: z.array(z.number().int()).min(1, 'At least one document ID is required'),
});

export const bulkUpdateDocumentsSchema = z.object({
  ids: z.array(z.number().int()).min(1, 'At least one document ID is required'),
  updates: z.object({
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

// 类型推断
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type GetDocumentInput = z.infer<typeof getDocumentSchema>;
export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>;
export type ListDocumentsInput = z.infer<typeof listDocumentsSchema>;
export type SearchDocumentsInput = z.infer<typeof searchDocumentsSchema>;
export type DocumentResponse = z.infer<typeof documentResponseSchema>;
export type DocumentStats = z.infer<typeof documentStatsSchema>;
export type BulkDeleteDocumentsInput = z.infer<typeof bulkDeleteDocumentsSchema>;
export type BulkUpdateDocumentsInput = z.infer<typeof bulkUpdateDocumentsSchema>;