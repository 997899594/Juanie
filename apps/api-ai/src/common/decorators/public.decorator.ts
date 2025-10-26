/**
 * 公开路由装饰器 - 标记不需要认证的端点
 */

import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/auth.guard';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);