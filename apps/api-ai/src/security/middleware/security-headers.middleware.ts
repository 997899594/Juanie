/**
 * 🚀 Juanie AI - 安全头中间件
 * 实现全面的HTTP安全防护
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getEnvVar, getBooleanEnvVar } from '../../core';

// ============================================================================
// 安全配置Schema
// ============================================================================

export const SecurityHeadersConfigSchema = z.object({
  // Content Security Policy
  csp: z.object({
    enabled: z.boolean().default(true),
    directives: z.record(z.string(), z.array(z.string())).default({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'", 'https:', 'wss:'],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'child-src': ["'self'"],
      'worker-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'manifest-src': ["'self'"],
    }),
    reportOnly: z.boolean().default(false),
    reportUri: z.string().optional(),
  }).default({}),
  
  // HTTP Strict Transport Security
  hsts: z.object({
    enabled: z.boolean().default(true),
    maxAge: z.number().default(31536000), // 1年
    includeSubDomains: z.boolean().default(true),
    preload: z.boolean().default(true),
  }).default({}),
  
  // X-Frame-Options
  frameOptions: z.object({
    enabled: z.boolean().default(true),
    action: z.enum(['DENY', 'SAMEORIGIN']).default('DENY'),
  }).default({}),
  
  // X-Content-Type-Options
  contentTypeOptions: z.object({
    enabled: z.boolean().default(true),
  }).default({}),
  
  // X-XSS-Protection
  xssProtection: z.object({
    enabled: z.boolean().default(true),
    mode: z.enum(['0', '1', '1; mode=block']).default('1; mode=block'),
  }).default({}),
  
  // Referrer Policy
  referrerPolicy: z.object({
    enabled: z.boolean().default(true),
    policy: z.enum([
      'no-referrer',
      'no-referrer-when-downgrade',
      'origin',
      'origin-when-cross-origin',
      'same-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
      'unsafe-url',
    ]).default('strict-origin-when-cross-origin'),
  }).default({}),
  
  // Permissions Policy
  permissionsPolicy: z.object({
    enabled: z.boolean().default(true),
    directives: z.record(z.string(), z.array(z.string())).default({
      'camera': [],
      'microphone': [],
      'geolocation': [],
      'payment': [],
      'usb': [],
      'magnetometer': [],
      'gyroscope': [],
      'accelerometer': [],
      'ambient-light-sensor': [],
      'autoplay': ['self'],
      'encrypted-media': ['self'],
      'fullscreen': ['self'],
      'picture-in-picture': ['self'],
    }),
  }).default({}),
  
  // Cross-Origin Embedder Policy
  coep: z.object({
    enabled: z.boolean().default(false),
    policy: z.enum(['unsafe-none', 'require-corp']).default('require-corp'),
  }).default({}),
  
  // Cross-Origin Opener Policy
  coop: z.object({
    enabled: z.boolean().default(false),
    policy: z.enum(['unsafe-none', 'same-origin-allow-popups', 'same-origin']).default('same-origin'),
  }).default({}),
  
  // Cross-Origin Resource Policy
  corp: z.object({
    enabled: z.boolean().default(false),
    policy: z.enum(['same-site', 'same-origin', 'cross-origin']).default('same-origin'),
  }).default({}),
  
  // 自定义头
  customHeaders: z.record(z.string(), z.string()).default({}),
  
  // 移除的头
  removeHeaders: z.array(z.string()).default([
    'X-Powered-By',
    'Server',
  ]),
});

export type SecurityHeadersConfig = z.infer<typeof SecurityHeadersConfigSchema>;

// ============================================================================
// 安全头中间件
// ============================================================================

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityHeadersMiddleware.name);
  private readonly config: SecurityHeadersConfig;
  
  // 统计信息
  private stats = {
    requestsProcessed: 0,
    cspViolations: 0,
    blockedRequests: 0,
    securityHeadersApplied: 0,
  };

  constructor() {
    // 从环境变量加载配置
    this.config = this.loadConfig();
    this.logger.log('Security headers middleware initialized');
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.stats.requestsProcessed++;
    
    try {
      // 移除不安全的响应头
      this.removeUnsafeHeaders(res);
      
      // 应用安全头
      this.applySecurityHeaders(req, res);
      
      // 设置CSP违规报告处理
      this.setupCSPReporting(req, res);
      
      this.stats.securityHeadersApplied++;
      
      next();
    } catch (error) {
      this.logger.error('Security headers middleware error', error);
      next(error);
    }
  }

  /**
   * 加载配置
   */
  private loadConfig(): SecurityHeadersConfig {
    const defaultConfig = SecurityHeadersConfigSchema.parse({});
    
    // 从环境变量覆盖配置
    const envConfig: Partial<SecurityHeadersConfig> = {
      csp: {
        enabled: getBooleanEnvVar('SECURITY_CSP_ENABLED', true),
        reportOnly: getBooleanEnvVar('SECURITY_CSP_REPORT_ONLY', false),
        reportUri: getEnvVar('SECURITY_CSP_REPORT_URI', undefined),
      },
      hsts: {
        enabled: getBooleanEnvVar('SECURITY_HSTS_ENABLED', true),
        maxAge: parseInt(getEnvVar('SECURITY_HSTS_MAX_AGE', '31536000')),
        includeSubDomains: getBooleanEnvVar('SECURITY_HSTS_INCLUDE_SUBDOMAINS', true),
        preload: getBooleanEnvVar('SECURITY_HSTS_PRELOAD', true),
      },
    };
    
    return SecurityHeadersConfigSchema.parse({
      ...defaultConfig,
      ...envConfig,
    });
  }

  /**
   * 移除不安全的响应头
   */
  private removeUnsafeHeaders(res: Response): void {
    for (const header of this.config.removeHeaders) {
      res.removeHeader(header);
    }
  }

  /**
   * 应用安全头
   */
  private applySecurityHeaders(req: Request, res: Response): void {
    // Content Security Policy
    if (this.config.csp.enabled) {
      this.setCSPHeader(res);
    }
    
    // HTTP Strict Transport Security
    if (this.config.hsts.enabled && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
      this.setHSTSHeader(res);
    }
    
    // X-Frame-Options
    if (this.config.frameOptions.enabled) {
      res.setHeader('X-Frame-Options', this.config.frameOptions.action);
    }
    
    // X-Content-Type-Options
    if (this.config.contentTypeOptions.enabled) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    
    // X-XSS-Protection
    if (this.config.xssProtection.enabled) {
      res.setHeader('X-XSS-Protection', this.config.xssProtection.mode);
    }
    
    // Referrer Policy
    if (this.config.referrerPolicy.enabled) {
      res.setHeader('Referrer-Policy', this.config.referrerPolicy.policy);
    }
    
    // Permissions Policy
    if (this.config.permissionsPolicy.enabled) {
      this.setPermissionsPolicyHeader(res);
    }
    
    // Cross-Origin Embedder Policy
    if (this.config.coep.enabled) {
      res.setHeader('Cross-Origin-Embedder-Policy', this.config.coep.policy);
    }
    
    // Cross-Origin Opener Policy
    if (this.config.coop.enabled) {
      res.setHeader('Cross-Origin-Opener-Policy', this.config.coop.policy);
    }
    
    // Cross-Origin Resource Policy
    if (this.config.corp.enabled) {
      res.setHeader('Cross-Origin-Resource-Policy', this.config.corp.policy);
    }
    
    // 自定义头
    for (const [name, value] of Object.entries(this.config.customHeaders)) {
      res.setHeader(name, value);
    }
    
    // 安全相关的通用头
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  }

  /**
   * 设置CSP头
   */
  private setCSPHeader(res: Response): void {
    const directives = Object.entries(this.config.csp.directives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
    
    let cspValue = directives;
    
    // 添加报告URI
    if (this.config.csp.reportUri) {
      cspValue += `; report-uri ${this.config.csp.reportUri}`;
    }
    
    const headerName = this.config.csp.reportOnly 
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
    
    res.setHeader(headerName, cspValue);
  }

  /**
   * 设置HSTS头
   */
  private setHSTSHeader(res: Response): void {
    let hstsValue = `max-age=${this.config.hsts.maxAge}`;
    
    if (this.config.hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }
    
    if (this.config.hsts.preload) {
      hstsValue += '; preload';
    }
    
    res.setHeader('Strict-Transport-Security', hstsValue);
  }

  /**
   * 设置权限策略头
   */
  private setPermissionsPolicyHeader(res: Response): void {
    const directives = Object.entries(this.config.permissionsPolicy.directives)
      .map(([feature, allowlist]) => {
        if (allowlist.length === 0) {
          return `${feature}=()`;
        }
        const sources = allowlist.map(source => 
          source === 'self' ? 'self' : `"${source}"`
        ).join(' ');
        return `${feature}=(${sources})`;
      })
      .join(', ');
    
    res.setHeader('Permissions-Policy', directives);
  }

  /**
   * 设置CSP违规报告处理
   */
  private setupCSPReporting(req: Request, res: Response): void {
    if (!this.config.csp.reportUri) return;
    
    // 如果是CSP违规报告请求
    if (req.path === this.config.csp.reportUri && req.method === 'POST') {
      this.handleCSPViolation(req);
    }
  }

  /**
   * 处理CSP违规报告
   */
  private handleCSPViolation(req: Request): void {
    try {
      const violation = req.body;
      this.stats.cspViolations++;
      
      this.logger.warn('CSP violation reported', {
        documentUri: violation['document-uri'],
        violatedDirective: violation['violated-directive'],
        blockedUri: violation['blocked-uri'],
        sourceFile: violation['source-file'],
        lineNumber: violation['line-number'],
        columnNumber: violation['column-number'],
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
      });
      
      // 可以在这里添加更多的违规处理逻辑
      // 例如：发送到监控系统、记录到数据库等
      
    } catch (error) {
      this.logger.error('Failed to process CSP violation report', error);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SecurityHeadersConfig>): void {
    try {
      const updatedConfig = SecurityHeadersConfigSchema.parse({
        ...this.config,
        ...newConfig,
      });
      
      Object.assign(this.config, updatedConfig);
      this.logger.log('Security headers configuration updated');
    } catch (error) {
      this.logger.error('Failed to update security headers configuration', error);
      throw error;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SecurityHeadersConfig {
    return { ...this.config };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cspViolationRate: this.stats.requestsProcessed > 0 
        ? this.stats.cspViolations / this.stats.requestsProcessed 
        : 0,
      securityHeadersRate: this.stats.requestsProcessed > 0
        ? this.stats.securityHeadersApplied / this.stats.requestsProcessed
        : 0,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      requestsProcessed: 0,
      cspViolations: 0,
      blockedRequests: 0,
      securityHeadersApplied: 0,
    };
    this.logger.log('Security headers statistics reset');
  }

  /**
   * 验证配置
   */
  validateConfig(config: any): boolean {
    try {
      SecurityHeadersConfigSchema.parse(config);
      return true;
    } catch (error) {
      this.logger.error('Invalid security headers configuration', error);
      return false;
    }
  }

  /**
   * 生成安全报告
   */
  generateSecurityReport() {
    return {
      timestamp: new Date(),
      config: this.getConfig(),
      stats: this.getStats(),
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * 生成安全建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!this.config.csp.enabled) {
      recommendations.push('Enable Content Security Policy for XSS protection');
    }
    
    if (!this.config.hsts.enabled) {
      recommendations.push('Enable HSTS to prevent protocol downgrade attacks');
    }
    
    if (this.config.csp.reportOnly) {
      recommendations.push('Consider enforcing CSP instead of report-only mode');
    }
    
    if (!this.config.permissionsPolicy.enabled) {
      recommendations.push('Enable Permissions Policy to control browser features');
    }
    
    if (this.stats.cspViolations > 0) {
      recommendations.push('Review and fix CSP violations to improve security');
    }
    
    return recommendations;
  }
}