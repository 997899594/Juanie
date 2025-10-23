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

  @Get("gitlab")
  async gitlabLogin(
    @Query("redirectTo") redirectTo?: string,
    @Res() res?: Response
  ) {
    try {
      const authUrl = await this.authService.createGitLabAuthUrl(
        redirectTo ? { provider: "gitlab", redirectTo } : { provider: "gitlab" }
      );

      res?.cookie("oauth_state", authUrl.state, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 10 * 60 * 1000, // 10分钟
        });

        return res?.redirect(authUrl.url);
    } catch (error: any) {
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
        session,
      } = await this.authService.handleGitLabCallback({ provider: "gitlab", code, state });

      res?.cookie("session", session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res?.clearCookie("oauth_state");

      // 使用传入的redirectTo参数，如果没有则重定向到前端首页
      const finalRedirectTo = redirectTo || process.env.FRONTEND_URL || "http://localhost:1997/";

      // 直接重定向，不使用中间页面
      return res?.redirect(finalRedirectTo);
    } catch (error: any) {
      console.error("GitLab callback error:", error);
      throw new HttpException(
        "GitLab authentication failed",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
