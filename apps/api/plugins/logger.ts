import type { NitroAppPlugin } from "nitropack";
import { logger } from "../src/middleware/logger.middleware";

const plugin: NitroAppPlugin = (nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    event.context = event.context || {};
    event.context._start = Date.now();
  });

  nitroApp.hooks.hook("afterResponse", (event) => {
    const start = event.context?._start || Date.now();
    const duration = Date.now() - start;

    const method = event.node.req.method || "";
    const path = event.path || event.node.req.url || "";
    const statusCode = event.node.res.statusCode;
    const uaHeader = event.node.req.headers["user-agent"];
    const userAgent = typeof uaHeader === "string" ? uaHeader : undefined;
    const ip = event.node.req.socket?.remoteAddress;

    // 仅在值存在时添加可选属性，满足 exactOptionalPropertyTypes
    const ctx: {
      method: string;
      path: string;
      duration: number;
      statusCode?: number;
      userAgent?: string;
      ip?: string;
      traceId?: string;
    } = { method, path, duration, statusCode };

    if (userAgent) ctx.userAgent = userAgent;
    if (ip) ctx.ip = ip;

    logger.logApiRequest(ctx);
  });

  nitroApp.hooks.hook("error", (error, { event }) => {
    const errCtx: { method?: string; path?: string } = {};
    const m = event?.node.req.method;
    const p = event?.path ?? event?.node.req.url;
    if (m) errCtx.method = m;
    if (p) errCtx.path = p;

    logger.error("HTTP error", {
      error: error instanceof Error ? error.message : String(error),
      ...errCtx,
    });
  });
};

export default plugin;
