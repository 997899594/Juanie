import { Module } from '@nestjs/common'
import { TemplateLoader } from './template-loader.service'
import { TemplateRenderer } from './template-renderer.service'

/**
 * 模板服务模块
 * 提供模板加载和渲染功能
 * 使用 EJS 模板引擎
 */
@Module({
  providers: [TemplateLoader, TemplateRenderer],
  exports: [TemplateLoader, TemplateRenderer],
})
export class TemplatesModule {}
