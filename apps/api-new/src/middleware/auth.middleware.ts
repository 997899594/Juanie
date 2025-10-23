import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth/auth.service';

// 扩展Request接口以包含用户和会话信息
interface AuthenticatedRequest extends Request {
  user?: any;
  session?: any;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // 从cookie中获取session token
      const sessionToken = req.cookies?.['session'];
      
      if (sessionToken) {
        // 验证session并获取用户信息
        const sessionData = await this.authService.validateSession(sessionToken);
        
        if (sessionData) {
          // 将用户和session信息添加到请求对象中
          req.user = sessionData.user;
          req.session = sessionData.session;
        }
      }
      
      next();
    } catch (error: any) {
      // 认证失败时不阻止请求，只是不设置用户信息
      next();
    }
  }
}