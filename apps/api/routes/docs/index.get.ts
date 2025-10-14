import {
  defineEventHandler,
  getHeader,
  getRequestURL,
  sendRedirect,
  setHeader,
} from "h3";
import { buildOpenApiDocument } from "@/openapi";

export default defineEventHandler((event) => {
  const accept = getHeader(event, "accept") || "";
  const url = event.node.req.url || "";
  const wantsJson =
    accept.includes("application/json") || url.includes("format=json");

  if (wantsJson) {
    const { protocol, host } = getRequestURL(event);
    const baseUrl = `${protocol}//${host}`;
    setHeader(event, "Content-Type", "application/json; charset=utf-8");
    const doc = buildOpenApiDocument(baseUrl);
    return doc;
  }

  // 重定向到 Scalar 文档 UI
  return sendRedirect(event, "/docs/scalar", 302);
});
