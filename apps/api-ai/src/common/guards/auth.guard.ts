/**
 * 认证守卫 - 保护需要认证的路由
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../modules/auth/auth.service';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公开路由
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    try {
      const sessionData = await this.authService.validateSession(token);
      
      if (!sessionData) {
        throw new UnauthorizedException('Invalid or expired session');
      }

      // 将用户信息附加到请求对象
      request.user = sessionData.user;
      request.session = sessionData.session;
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Authentication failed: ${errorMessage}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}