import { Logger } from '@nestjs/common';
import { DomainEvent } from '../event-sourcing/event-store';
import { z } from 'zod';

// 聚合根状态Schema
export const AggregateStateSchema = z.object({
  id: z.string(),
  version: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  isDeleted: z.boolean().default(false),
});

export type AggregateState = z.infer<typeof AggregateStateSchema>;

// 聚合根基类
export abstract class AggregateRoot<T extends AggregateState = AggregateState> {
  protected readonly logger = new Logger(this.constructor.name);
  
  protected _id: string;
  protected _version: number = 0;
  protected _uncommittedEvents: DomainEvent[] = [];
  protected _state: T;
  protected _createdAt: Date;
  protected _updatedAt: Date;
  protected _isDeleted: boolean = false;

  constructor(id: string, initialState?: Partial<T>) {
    this._id = id;
    this._createdAt = new Date();
    this._updatedAt = new Date();
    
    // 初始化状态
    this._state = {
      id,
      version: 0,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      isDeleted: false,
      ...initialState,
    } as T;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get state(): T {
    return { ...this._state };
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isDeleted(): boolean {
    return this._isDeleted;
  }

  get uncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  get hasUncommittedEvents(): boolean {
    return this._uncommittedEvents.length > 0;
  }

  // 应用事件（重放历史事件）
  applyEvent(event: DomainEvent, isNew = false): void {
    try {
      // 验证事件版本
      if (event.version !== this._version + 1) {
        throw new Error(
          `Invalid event version. Expected ${this._version + 1}, got ${event.version}`
        );
      }

      // 应用事件到状态
      this.when(event);
      
      // 更新版本和时间戳
      this._version = event.version;
      this._updatedAt = event.timestamp;
      this._state.version = this._version;
      this._state.updatedAt = this._updatedAt;

      // 如果是新事件，添加到未提交事件列表
      if (isNew) {
        this._uncommittedEvents.push(event);
      }

      this.logger.debug(`Applied event ${event.eventType} to ${this._id}`);
    } catch (error) {
      this.logger.error(`Failed to apply event ${event.eventType}:`, error);
      throw error;
    }
  }

  // 抽象方法：子类实现具体的事件处理逻辑
  protected abstract when(event: DomainEvent): void;

  // 抽象方法：获取聚合类型
  abstract getAggregateType(): string;

  // 引发新事件
  protected raiseEvent(eventData: any, eventClass: new (...args: any[]) => DomainEvent): void {
    const event = new eventClass(
      this._id,
      this.getAggregateType(),
      this._version + 1,
      eventData,
      {
        correlationId: this.getCurrentCorrelationId(),
        causationId: this.getCurrentCausationId(),
        userId: this.getCurrentUserId(),
      }
    );

    this.applyEvent(event, true);
  }

  // 标记事件为已提交
  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
    this.logger.debug(`Marked events as committed for ${this._id}`);
  }

  // 从快照恢复
  loadFromSnapshot(snapshot: { version: number; data: any }): void {
    this._version = snapshot.version;
    this._state = { ...this._state, ...snapshot.data };
    this._updatedAt = this._state.updatedAt;
    this._isDeleted = this._state.isDeleted;
    
    this.logger.debug(`Loaded from snapshot: ${this._id} at version ${this._version}`);
  }

  // 创建快照
  createSnapshot(): { version: number; data: T } {
    return {
      version: this._version,
      data: { ...this._state },
    };
  }

  // 验证聚合状态
  validate(): boolean {
    try {
      AggregateStateSchema.parse(this._state);
      return this.validateBusinessRules();
    } catch (error) {
      this.logger.error(`Validation failed for ${this._id}:`, error);
      return false;
    }
  }

  // 抽象方法：业务规则验证
  protected abstract validateBusinessRules(): boolean;

  // 软删除
  protected markAsDeleted(): void {
    this._isDeleted = true;
    this._state.isDeleted = true;
    this._updatedAt = new Date();
    this._state.updatedAt = this._updatedAt;
  }

  // 检查是否可以执行操作
  protected ensureNotDeleted(): void {
    if (this._isDeleted) {
      throw new Error(`Cannot perform operation on deleted aggregate: ${this._id}`);
    }
  }

  // 获取当前上下文信息（可以从请求上下文中获取）
  protected getCurrentCorrelationId(): string | undefined {
    // TODO: 从请求上下文获取
    return undefined;
  }

  protected getCurrentCausationId(): string | undefined {
    // TODO: 从请求上下文获取
    return undefined;
  }

  protected getCurrentUserId(): string | undefined {
    // TODO: 从请求上下文获取
    return undefined;
  }

  // 调试信息
  getDebugInfo() {
    return {
      id: this._id,
      version: this._version,
      aggregateType: this.getAggregateType(),
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      isDeleted: this._isDeleted,
      uncommittedEventsCount: this._uncommittedEvents.length,
      state: this._state,
    };
  }
}

// 聚合仓储接口
export interface IAggregateRepository<T extends AggregateRoot> {
  save(aggregate: T): Promise<void>;
  getById(id: string): Promise<T | null>;
  exists(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}

// 基础聚合仓储实现
export abstract class BaseAggregateRepository<T extends AggregateRoot> 
  implements IAggregateRepository<T> {
  
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected eventStore: any, // IEventStore
    protected snapshotFrequency: number = 10, // 每10个事件创建一次快照
  ) {}

  async save(aggregate: T): Promise<void> {
    if (!aggregate.hasUncommittedEvents) {
      return;
    }

    try {
      // 保存未提交的事件
      await this.eventStore.append(aggregate.uncommittedEvents);
      
      // 检查是否需要创建快照
      if (aggregate.version % this.snapshotFrequency === 0) {
        const snapshot = aggregate.createSnapshot();
        await this.eventStore.createSnapshot(aggregate.id, snapshot.version, snapshot.data);
      }

      // 标记事件为已提交
      aggregate.markEventsAsCommitted();
      
      this.logger.debug(`Saved aggregate ${aggregate.id} at version ${aggregate.version}`);
    } catch (error) {
      this.logger.error(`Failed to save aggregate ${aggregate.id}:`, error);
      throw error;
    }
  }

  async getById(id: string): Promise<T | null> {
    try {
      // 尝试从快照恢复
      const snapshot = await this.eventStore.getSnapshot(id);
      let aggregate: T;
      let fromVersion = 0;

      if (snapshot) {
        aggregate = this.createEmptyAggregate(id);
        aggregate.loadFromSnapshot(snapshot);
        fromVersion = snapshot.version + 1;
      } else {
        aggregate = this.createEmptyAggregate(id);
      }

      // 应用快照之后的事件
      const events = await this.eventStore.getEvents(id, fromVersion);
      
      if (events.length === 0 && !snapshot) {
        return null; // 聚合不存在
      }

      for (const event of events) {
        aggregate.applyEvent(event, false);
      }

      this.logger.debug(`Loaded aggregate ${id} at version ${aggregate.version}`);
      return aggregate;
    } catch (error) {
      this.logger.error(`Failed to load aggregate ${id}:`, error);
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    const events = await this.eventStore.getEvents(id);
    return events.length > 0;
  }

  async delete(id: string): Promise<void> {
    // 在事件溯源中，我们通常不物理删除，而是标记为删除
    // 这里可以实现软删除逻辑
    throw new Error('Delete operation should be implemented as a domain command');
  }

  // 抽象方法：创建空的聚合实例
  protected abstract createEmptyAggregate(id: string): T;
}