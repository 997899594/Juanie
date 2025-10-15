import type { H3Event } from "h3";
import { DrizzleService } from "../../drizzle/drizzle.service";
import type { User } from "../../drizzle/schemas/users";
import { AuthService } from "../../modules/auth/services/auth.service";
import { GitService } from "../../modules/git/services/git.service";
import { HealthService } from "../../modules/health/services/health.service";
import type { RateLimitInfo } from "../types/index";

export interface Context {
  req: H3Event["node"]["req"];
  resHeaders: Record<string, string>;
  user?: User;
  rateLimitInfo?: RateLimitInfo;
  authService: AuthService;
  drizzleService: DrizzleService;
  healthService: HealthService;
  gitService: GitService;
}

export async function createContext(opts: {
  req: H3Event["node"]["req"];
  resHeaders: Record<string, string>;
}): Promise<Context> {
  const { req, resHeaders } = opts;

  // 使用服务容器获取预初始化的服务实例
  const { getServiceContainer } = await import("../service-container");
  const serviceContainer = getServiceContainer();

  if (!serviceContainer.initialized) {
    throw new Error("服务容器未初始化，请确保 NestJS 应用已正确启动");
  }

  // 获取所有服务实例（已预加载和缓存）
  const services = serviceContainer.getAllServices();

  // 提取用户信息
  const user = await extractUserFromRequest(req, services.authService);

  return {
    req,
    resHeaders,
    user,
    authService: services.authService,
    drizzleService: services.drizzleService,
    healthService: services.healthService,
    gitService: services.gitService,
  };
}

async function extractUserFromRequest(
  req: H3Event["node"]["req"],
  authService: AuthService
): Promise<User | undefined> {
  const token = extractTokenFromRequest(req);
  if (!token) return undefined;

  try {
    const u = await authService.validateToken(token);
    return u ?? undefined;
  } catch {
    return undefined;
  }
}

function extractTokenFromRequest(
  req: H3Event["node"]["req"]
): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    return cookies.token;
  }

  return undefined;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {} as Record<string, string>);
}
