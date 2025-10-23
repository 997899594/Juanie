import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GitLabModule } from "../gitlab/gitlab.module";
import { DocumentsModule } from "../documents/documents.module";
import { ProjectsModule } from "../projects/projects.module";
import { EnvironmentsModule } from "../environments/environments.module";
import { DeploymentsModule } from "../deployments/deployments.module";
import { TrpcService } from "./trpc.service";

@Module({
  imports: [AuthModule, GitLabModule, DocumentsModule, ProjectsModule, EnvironmentsModule, DeploymentsModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
