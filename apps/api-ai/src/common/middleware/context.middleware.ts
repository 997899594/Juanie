/**
 * 上下文中间件 - 为tRPC提供请求上下文
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../modules/auth/auth.service';

export interface RequestWithContext extends Request {
  trpcContext?: {
    user?: {
      id: string;
      email: string;
      organizationId?: string;
    };
  };
}

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ContextMiddleware.name);

  constructor(private readonly authService: AuthService) {}

  async use(req: RequestWithContext, res: Response, next: NextFunction) {
    try {
      // 提取认证token
      const token = this.extractTokenFromHeader(req);
      
      if (token) {
        const sessionData = await this.authService.validateSession(token);
        
        if (sessionData) {
          // 设置tRPC上下文
          req.trpcContext = {
            user: {
              id: sessionData.user.id,
              email: sessionData.user.email,
              // 这里可以添加组织ID等其他信息
            },
          };
        }
      }
    } catch (error) {
      // 静默处理认证错误，让tRPC的中间件处理
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.debug(`Context middleware auth check failed: ${errorMessage}`);
    }

    next();
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}