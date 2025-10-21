import { Injectable } from '@nestjs/common';

export interface CachedSession {
  id: string;
  userId: number;  // 改回number类型以匹配schema
  expires: string; // 改为string类型以匹配schema
}

@Injectable()
export class SessionCacheService {
  private cache = new Map<string, CachedSession>();

  get(sessionId: string): CachedSession | undefined {
    return this.cache.get(sessionId);
  }

  set(sessionId: string, session: CachedSession): void {
    this.cache.set(sessionId, session);
  }

  delete(sessionId: string): void {
    this.cache.delete(sessionId);
  }

  clear(): void {
    this.cache.clear();
  }
}