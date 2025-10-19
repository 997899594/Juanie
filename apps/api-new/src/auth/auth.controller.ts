import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("github")
  async githubLogin(
    @Query("redirect_to") redirectTo?: string,
    @Res() res?: Response
  ) {
    try {
      const { url, state } = await this.authService.createGitHubAuthUrl(
        redirectTo
      );

      // 设置状态 cookie 作为额外验证
      res?.cookie("oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60 * 1000, // 10分钟
      });

      return res?.redirect(url);
    } catch (error) {
      throw new HttpException(
        "Failed to initiate GitHub OAuth",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("github/callback")
  async githubCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("redirect_to") redirectTo?: string,
    @Res() res?: Response
  ) {
    if (!code || !state) {
      throw new HttpException(
        "Missing authorization code or state",
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const {
        user,
        sessionId,
        redirectTo: storedRedirectTo,
      } = await this.authService.handleGitHubCallback(code, state);

      res?.cookie("session", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res?.clearCookie("oauth_state");

      // 优先使用存储的redirectTo
      const finalRedirectTo =
        storedRedirectTo || redirectTo || "http://localhost:1997/dashboard";

      // 返回美观的中间页面而不是直接重定向
      return this.renderCallbackPage(res, finalRedirectTo);
    } catch (error) {
      console.error("GitHub callback error:", error);
      throw new HttpException(
        "GitHub authentication failed",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("gitlab")
  async gitlabLogin(
    @Query("redirectTo") redirectTo?: string,
    @Res() res?: Response
  ) {
    try {
      const { url, state } = await this.authService.createGitLabAuthUrl(
        redirectTo
      );

      res?.cookie("oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60 * 1000, // 10分钟
      });

      return res?.redirect(url);
    } catch (error) {
      throw new HttpException(
        "Failed to initiate GitLab OAuth",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("gitlab/callback")
  async gitlabCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("redirect_to") redirectTo?: string,
    @Res() res?: Response
  ) {
    if (!code || !state) {
      throw new HttpException(
        "Missing authorization code or state",
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const {
        user,
        sessionId,
        redirectTo: storedRedirectTo,
      } = await this.authService.handleGitLabCallback(code, state);

      res?.cookie("session", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res?.clearCookie("oauth_state");

      // 优先使用存储的redirectTo
      const finalRedirectTo =
        storedRedirectTo || redirectTo || "http://localhost:1997/dashboard";

      // 返回美观的中间页面而不是直接重定向
      return this.renderCallbackPage(res, finalRedirectTo);
    } catch (error) {
      console.error("GitLab callback error:", error);
      throw new HttpException(
        "GitLab authentication failed",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private renderCallbackPage(res: Response | undefined, redirectUrl: string) {
    if (!res) {
      return;
    }
    
    const fs = require('fs');
    const path = require('path');
    
    try {
      // 根据环境选择正确的模板路径
      let templatePath: string;
      
      if (process.env.NODE_ENV === 'production') {
        // 生产环境：从dist目录加载
        templatePath = path.resolve(process.cwd(), 'dist/auth/templates/oauth-callback.html');
      } else {
        // 开发环境：从src目录加载
        templatePath = path.resolve(process.cwd(), 'src/auth/templates/oauth-callback.html');
      }
      
      console.log('尝试加载模板文件:', templatePath);
      console.log('文件是否存在:', fs.existsSync(templatePath));
      
      let html = fs.readFileSync(templatePath, 'utf8');
      
      // 替换模板中的重定向URL
      console.log('替换前的 redirectUrl:', redirectUrl);
      html = html.replace(/\{\{REDIRECT_URL\}\}/g, redirectUrl);
      console.log('模板替换完成');
      
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (error) {
      // 如果模板文件不存在，回退到直接重定向
      console.warn('OAuth callback template not found, falling back to direct redirect');
      console.error('模板加载错误:', error.message);
      return res.redirect(redirectUrl);
    }
  }
}
