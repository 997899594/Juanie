import { Injectable, Logger } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';

@Injectable()
export class RepositoriesService {
  private readonly logger = new Logger(RepositoriesService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  // TODO: Implement methods for managing repositories

  hello(): string {
    return 'Hello from RepositoriesService!';
  }
}