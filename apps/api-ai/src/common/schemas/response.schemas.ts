import { z } from 'zod';

/**
 * 统一API响应格式
 */
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

/**
 * 分页响应格式
 */
export const paginatedResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.any()),
  total: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
  message: z.string().optional(),
});

/**
 * 导出类型
 */
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

export type PaginatedResponse<T = any> = {
  success: boolean;
  data: T[];
  total: number;
  limit: number;
  offset: number;
  message?: string;
};