import { Injectable, Logger } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';

@Injectable()
export class ProjectMembershipsService {
  constructor(private readonly logger: Logger, private readonly database: Database) {}

  async hello(): Promise<string> {
    this.logger.log('Hello from ProjectMembershipsService');
    return 'Hello from ProjectMembershipsService';
  }
}