import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { DocumentsService } from "../../documents/documents.service";
import { 
  createDocumentSchema,
  updateDocumentSchema,
  getDocumentSchema,
  deleteDocumentSchema,
  listDocumentsSchema,
  searchDocumentsSchema,
  documentResponseSchema,
  bulkDeleteDocumentsSchema,
  bulkUpdateDocumentsSchema
} from "../../schemas/document.schema";

export function createDocumentsRouter(documentsService: DocumentsService) {
  return createTRPCRouter({
    // 创建文档
    create: publicProcedure
      .input(createDocumentSchema)
      .output(documentResponseSchema)
      .mutation(async ({ input }) => {
        return documentsService.createWithEmbedding(input);
      }),

    // 获取所有文档
    findAll: publicProcedure
      .input(listDocumentsSchema.optional())
      .output(z.array(documentResponseSchema))
      .query(async ({ input }) => {
        return documentsService.findAll(input);
      }),

    // 根据ID获取文档
    findById: publicProcedure
      .input(getDocumentSchema)
      .output(documentResponseSchema.nullable())
      .query(async ({ input }) => {
        return documentsService.findById(input.id);
      }),

    // 更新文档
    update: publicProcedure
      .input(updateDocumentSchema)
      .output(documentResponseSchema)
      .mutation(async ({ input }) => {
        return documentsService.update(input);
      }),

    // 删除文档
    delete: publicProcedure
      .input(deleteDocumentSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input }) => {
        return documentsService.delete(input.id);
      }),

    // 搜索文档
    search: publicProcedure
      .input(searchDocumentsSchema)
      .output(z.array(documentResponseSchema))
      .query(async ({ input }) => {
        return documentsService.search(input);
      }),

    // 批量删除
    bulkDelete: publicProcedure
      .input(bulkDeleteDocumentsSchema)
      .output(z.object({ deletedCount: z.number() }))
      .mutation(async ({ input }) => {
        return documentsService.bulkDelete(input.ids);
      }),

    // 批量更新
    bulkUpdate: publicProcedure
      .input(bulkUpdateDocumentsSchema)
      .output(z.object({ updatedCount: z.number() }))
      .mutation(async ({ input }) => {
        return documentsService.bulkUpdate(input.ids, input.updates);
      }),

    // 获取统计信息
    getStats: publicProcedure
      .output(z.object({
        total: z.number(),
        totalWithEmbedding: z.number(),
        averageLength: z.number(),
        tagCount: z.number()
      }))
      .query(async () => {
        return documentsService.getStats();
      }),
  });
}