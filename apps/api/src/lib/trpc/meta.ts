// tRPC Meta 类型定义，用于 OpenAPI 集成
export interface OpenApiMeta {
  openapi?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    tags?: string[];
    summary?: string;
    description?: string;
    protect?: boolean;
  };
}

// 扩展 TRPCMeta 以支持 trpc-to-openapi
export interface TRPCMeta extends Record<string, unknown> {
  openapi?: OpenApiMeta['openapi'];
}