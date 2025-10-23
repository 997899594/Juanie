import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DocumentsService } from "../../documents/documents.service";
import {
  createDocumentSchema,
  updateDocumentSchema,
  getDocumentSchema,
  listDocumentsSchema,
  deleteDocumentSchema,
  searchDocumentsSchema,
  documentResponseSchema,
} from "../../schemas/document.schema";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const createDocumentsRouter = (documentsService: DocumentsService) => {
  return createTRPCRouter({
    // 获取所有文档
    findAll: protectedProcedure
      .input(z.object({}).optional())
      .output(z.array(documentResponseSchema))
      .query(async ({ ctx }) => {
        return await documentsService.findAll();
      }),

    // 根据ID获取文档
    findById: protectedProcedure
      .input(getDocumentSchema)
      .output(documentResponseSchema.nullable())
      .query(async ({ input, ctx }) => {
        return await documentsService.findById(Number(input));
      }),

    // 创建文档
    create: protectedProcedure
      .input(createDocumentSchema)
      .output(documentResponseSchema)
      .mutation(async ({ input, ctx }) => {
        return await documentsService.createWithEmbedding(input);
      }),

    // 更新文档
    update: protectedProcedure
      .input(updateDocumentSchema)
      .output(documentResponseSchema)
      .mutation(async ({ input, ctx }) => {
        return await documentsService.update(input);
      }),

    // 删除文档
    delete: protectedProcedure
      .input(deleteDocumentSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await documentsService.delete(Number(input));
        return { success: true };
      }),

    // 搜索文档
    search: protectedProcedure
      .input(searchDocumentsSchema)
      .output(z.array(documentResponseSchema))
      .query(async ({ input, ctx }) => {
        return await documentsService.search(input);
      }),

    // 获取文档统计
    getStats: protectedProcedure
      .input(z.object({}).optional())
      .output(z.object({
        total: z.number(),
        recent: z.number(),
      }))
      .query(async ({ ctx }) => {
        // 这里需要在 DocumentsService 中实现 getStats 方法
        // 暂时返回模拟数据
        return {
          total: 0,
          recent: 0,
        };
      }),
  });
};