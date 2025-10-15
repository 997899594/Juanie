import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DrizzleService } from "./drizzle.service";

@Global()
@Module({
  providers: [
    {
      provide: DrizzleService,
      useFactory: (configService: ConfigService) =>
        new DrizzleService(configService),
      inject: [ConfigService],
    },
  ],
  exports: [DrizzleService],
})
export class DrizzleModule {}
