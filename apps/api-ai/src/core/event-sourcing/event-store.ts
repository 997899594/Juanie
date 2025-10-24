import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { performance } from 'perf_hooks';

// 事件元数据Schema
export const EventMetadataSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  aggregateId: z.string(),
  aggregateType: z.string(),
  version: z.number(),
  timestamp: z.date(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;

// 领域事件基类
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly version: number;
  public readonly timestamp: Date;
  public readonly correlationId?: string;
  public readonly causationId?: string;
  public readonly userId?: string;
  public readonly metadata?: Record<string, any>;

  constructor(
    aggregateId: string,
    aggregateType: string,
    version: number,
    data: any,
    metadata?: Partial<EventMetadata>
  ) {
    this.eventId = nanoid();
    this.eventType = this.constructor.name;
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.version = version;
    this.timestamp = new Date();
    this.correlationId = metadata?.correlationId;
    this.causationId = metadata?.causationId;
    this.userId = metadata?.userId;
    this.metadata = metadata?.metadata;
    
    Object.assign(this, data);
  }

  abstract validate(): boolean;
}

// 事件存储接口
export interface IEventStore {
  append(events: DomainEvent[]): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getAllEvents(fromTimestamp?: Date): Promise<DomainEvent[]>;
  getEventsByType(eventType: string): Promise<DomainEvent[]>;
  createSnapshot(aggregateId: string, version: number, data: any): Promise<void>;
  getSnapshot(aggregateId: string): Promise<{ version: number; data: any } | null>;
}

// 内存事件存储实现（开发环境）
@Injectable()
export class InMemoryEventStore implements IEventStore {
  private readonly logger = new Logger(InMemoryEventStore.name);
  private events: Map<string, DomainEvent[]> = new Map();
  private snapshots: Map<string, { version: number; data: any }> = new Map();
  private globalEvents: DomainEvent[] = [];

  constructor(private eventEmitter: EventEmitter2) {}

  async append(events: DomainEvent[]): Promise<void> {
    const startTime = performance.now();
    
    for (const event of events) {
      // 验证事件
      if (!event.validate()) {
        throw new Error(`Invalid event: ${event.eventType}`);
      }

      // 存储到聚合事件流
      const aggregateEvents = this.events.get(event.aggregateId) || [];
      aggregateEvents.push(event);
      this.events.set(event.aggregateId, aggregateEvents);

      // 存储到全局事件流
      this.globalEvents.push(event);

      // 发布事件到事件总线
      await this.eventEmitter.emitAsync(event.eventType, event);
      await this.eventEmitter.emitAsync('domain.event', event);

      this.logger.debug(`Event stored: ${event.eventType} for ${event.aggregateId}`);
    }

    const duration = performance.now() - startTime;
    this.logger.log(`Stored ${events.length} events in ${duration.toFixed(2)}ms`);
  }

  async getEvents(aggregateId: string, fromVersion = 0): Promise<DomainEvent[]> {
    const events = this.events.get(aggregateId) || [];
    return events.filter(event => event.version >= fromVersion);
  }

  async getAllEvents(fromTimestamp?: Date): Promise<DomainEvent[]> {
    if (!fromTimestamp) {
      return [...this.globalEvents];
    }
    return this.globalEvents.filter(event => event.timestamp >= fromTimestamp);
  }

  async getEventsByType(eventType: string): Promise<DomainEvent[]> {
    return this.globalEvents.filter(event => event.eventType === eventType);
  }

  async createSnapshot(aggregateId: string, version: number, data: any): Promise<void> {
    this.snapshots.set(aggregateId, { version, data });
    this.logger.debug(`Snapshot created for ${aggregateId} at version ${version}`);
  }

  async getSnapshot(aggregateId: string): Promise<{ version: number; data: any } | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  // 开发工具方法
  getStats() {
    return {
      totalEvents: this.globalEvents.length,
      aggregates: this.events.size,
      snapshots: this.snapshots.size,
      eventTypes: [...new Set(this.globalEvents.map(e => e.eventType))],
    };
  }

  clear() {
    this.events.clear();
    this.snapshots.clear();
    this.globalEvents = [];
    this.logger.warn('Event store cleared');
  }
}

// PostgreSQL事件存储实现（生产环境）
@Injectable()
export class PostgreSQLEventStore implements IEventStore {
  private readonly logger = new Logger(PostgreSQLEventStore.name);

  constructor(
    private eventEmitter: EventEmitter2,
    // 这里会注入Drizzle数据库连接
  ) {}

  async append(events: DomainEvent[]): Promise<void> {
    // TODO: 实现PostgreSQL存储逻辑
    // 使用事务确保原子性
    // 实现乐观并发控制
    // 支持分区表优化性能
    throw new Error('PostgreSQL EventStore not implemented yet');
  }

  async getEvents(aggregateId: string, fromVersion = 0): Promise<DomainEvent[]> {
    // TODO: 实现PostgreSQL查询逻辑
    throw new Error('PostgreSQL EventStore not implemented yet');
  }

  async getAllEvents(fromTimestamp?: Date): Promise<DomainEvent[]> {
    // TODO: 实现PostgreSQL查询逻辑
    throw new Error('PostgreSQL EventStore not implemented yet');
  }

  async getEventsByType(eventType: string): Promise<DomainEvent[]> {
    // TODO: 实现PostgreSQL查询逻辑
    throw new Error('PostgreSQL EventStore not implemented yet');
  }

  async createSnapshot(aggregateId: string, version: number, data: any): Promise<void> {
    // TODO: 实现PostgreSQL快照存储
    throw new Error('PostgreSQL EventStore not implemented yet');
  }

  async getSnapshot(aggregateId: string): Promise<{ version: number; data: any } | null> {
    // TODO: 实现PostgreSQL快照查询
    throw new Error('PostgreSQL EventStore not implemented yet');
  }
}

// 事件存储工厂
@Injectable()
export class EventStoreFactory {
  constructor(
    private inMemoryStore: InMemoryEventStore,
    private postgreSQLStore: PostgreSQLEventStore,
  ) {}

  create(type: 'memory' | 'postgresql' = 'memory'): IEventStore {
    switch (type) {
      case 'memory':
        return this.inMemoryStore;
      case 'postgresql':
        return this.postgreSQLStore;
      default:
        throw new Error(`Unknown event store type: ${type}`);
    }
  }
}