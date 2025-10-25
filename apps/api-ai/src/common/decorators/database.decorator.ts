/**
 * 数据库注入装饰器
 * 简化数据库连接的注入过程
 */

import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../database/database.module';

export const InjectDatabase = () => Inject(DATABASE_CONNECTION);