import { Injectable, Logger } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';

@Injectable()
export class EnvironmentsService {
  private readonly logger = new Logger(EnvironmentsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  // TODO: Implement methods for managing environments

  hello(): string {
    return 'Hello from EnvironmentsService!';
  }
}