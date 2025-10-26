import { Injectable, Logger } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  // TODO: Implement roles management logic here

  hello(): string {
    return 'Hello from RolesService!';
  }
}