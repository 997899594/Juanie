/**
 * 🚀 Juanie AI - 角色装饰器
 * 用于标记需要特定角色的路由
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);