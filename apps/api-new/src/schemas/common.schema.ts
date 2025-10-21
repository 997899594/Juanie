import { z } from 'zod';

// 通用分页参数
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).optional(),
});

// 通用排序参数
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 通用搜索参数
export const searchSchema = z.object({
  search: z.string().min(1).optional(),
  searchFields: z.array(z.string()).optional(),
});

// 通用ID参数
export const idSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? parseInt(val, 10) : val
  ),
});

// 通用批量操作参数
export const bulkOperationSchema = z.object({
  ids: z.array(z.union([z.string(), z.number()])).min(1),
});

// 通用日期范围参数
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// 通用响应格式
export const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  message: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  timestamp: z.string().datetime(),
});

// 分页响应格式 - 作为函数使用
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.literal(true),
  data: z.array(dataSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
  timestamp: z.string().datetime(),
});

// 类型推断
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SortInput = z.infer<typeof sortSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type IdInput = z.infer<typeof idSchema>;
export type BulkOperationInput = z.infer<typeof bulkOperationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type SuccessResponse<T = any> = Omit<z.infer<typeof successResponseSchema>, 'data'> & { data: T };
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type PaginatedResponse<T = any> = Omit<z.infer<typeof paginatedResponseSchema>, 'data'> & { data: T[] };