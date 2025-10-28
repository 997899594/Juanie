import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { TrpcService } from "../../trpc/trpc.service";
import { ProjectMembershipsRouter } from "./project-memberships.router";
import { ProjectMembershipsService } from "./project-memberships.service";

@Module({
  imports: [DatabaseModule],
  providers: [ProjectMembershipsService, ProjectMembershipsRouter, TrpcService],
  exports: [ProjectMembershipsService, ProjectMembershipsRouter],
})
export class ProjectMembershipsModule {}
