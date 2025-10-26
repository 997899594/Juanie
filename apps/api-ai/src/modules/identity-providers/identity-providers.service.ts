import { Injectable, Logger } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';

@Injectable()
export class IdentityProvidersService {
  private readonly logger = new Logger(IdentityProvidersService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  hello() {
    return 'Hello from Identity Providers Service';
  }

  // TODO: Implement methods for managing identity providers
}