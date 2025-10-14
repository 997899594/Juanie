import type { H3Event } from "h3";
import { DrizzleService } from "../../drizzle/drizzle.service";
import { AuthService } from "../../modules/auth/services/auth.service";
import { GitService } from "../../modules/git/services/git.service";
import { HealthService } from "../../modules/health/services/health.service";
import { getNestApp } from "../../nest";
import type { RateLimitInfo, User } from "../types";

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
  const nestApp = await getNestApp();

  // 获取服务实例
  const authService = nestApp.get(AuthService);
  const drizzleService = nestApp.get(DrizzleService);
  const healthService = nestApp.get(HealthService);
  const gitService = nestApp.get(GitService);

  // 提取用户信息
  const user = await extractUserFromRequest(req, authService);

  return {
    req,
    resHeaders,
    user,
    authService,
    drizzleService,
    healthService,
    gitService,
  };
}

async function extractUserFromRequest(
  req: H3Event["node"]["req"],
  authService: AuthService
): Promise<User | undefined> {
  const token = extractTokenFromRequest(req);
  if (!token) return undefined;

  try {
    return await authService.validateToken(token);
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
