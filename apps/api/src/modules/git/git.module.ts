import { Module } from "@nestjs/common";
import { DrizzleModule } from "../../drizzle/drizzle.module";
import { GitProviderFactory } from "./providers/git-provider.factory";
import { GitService } from "./services/git.service";
import { GitBranchService } from "./services/git-branch.service";
import { GitMergeRequestService } from "./services/git-merge-request.service";
import { GitRepositoryService } from "./services/git-repository.service";
import { GitWebhookService } from "./services/git-webhook.service";

@Module({
  imports: [DrizzleModule],
  providers: [
    GitProviderFactory,
    GitBranchService,
    GitMergeRequestService,
    GitRepositoryService,
    GitWebhookService,
    GitService,
  ],
  exports: [
    GitBranchService,
    GitMergeRequestService,
    GitRepositoryService,
    GitWebhookService,
    GitService,
  ],
})
export class GitModule {}
