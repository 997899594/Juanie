import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const sessionId = req.cookies?.session;
    
    if (sessionId) {
      try {
        const sessionData = await this.authService.validateSession(sessionId);
        if (sessionData) {
          req.user = sessionData.user;
          req.session = sessionData.session;
        }
      } catch (error) {
        // 会话验证失败，继续处理但不设置用户信息
      }
    }
    
    next();
  }
}