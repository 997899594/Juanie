import { Module } from '@nestjs/common'
import { TemplateLoader } from '../template-loader.service'
import { TemplateManager } from '../template-manager.service'
import { TemplateRenderer } from '../template-renderer.service'

/**
 * 模板服务模块
 * 提供模板加载、管理和渲染功能
 * 可以被其他模块导入使用
 */
@Module({
  providers: [TemplateManager, TemplateLoader, TemplateRenderer],
  exports: [TemplateManager, TemplateLoader, TemplateRenderer],
})
export class TemplatesModule {}
