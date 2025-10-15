import type { AppRouter } from "@juanie/api";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";

// todo: devtoolsLink 过时

const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * tRPC 客户端配置
 * 集成了DevTools支持，用于开发时调试tRPC请求
 */
export const trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> =
  createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/trpc`,
        // 允许跨域携带 Cookie（与服务端 CORS 的 Allow-Credentials 配置保持一致）
        fetch: (url, options) =>
          fetch(url, {
            ...options,
            credentials: "include",
          }),
        // 可以在这里添加认证头
        // headers() {
        //   return {
        //     authorization: getAuthCookie(),
        //   }
        // },
      }),
    ],
  });

export type { AppRouter };
