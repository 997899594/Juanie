import { Gitlab } from "@gitbeaker/rest";
import { Injectable } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type {
  GitBranchInfo,
  GitMergeRequestInfo,
  GitRepositoryInfo,
} from "../interfaces/git-provider.interface";
import { BaseGitProvider } from "./base-git.provider";

@Injectable()
export class GitLabProvider extends BaseGitProvider {
  private gitlab: Gitlab;

  constructor(
    private configService: ConfigService,
    accessToken: string,
    baseUrl?: string
  ) {
    super();
    this.gitlab = new Gitlab({
      token: accessToken,
      host: baseUrl || this.configService.get("GITLAB_BASE_URL"),
    });
  }

  async getRepositories(): Promise<GitRepositoryInfo[]> {
    return this.withRetry(
      async () => {
        const projects = await this.gitlab.Projects.all({
          membership: true,
          per_page: 100,
        });

        return projects.map((project) => ({
          id: project.id.toString(),
          name: project.name,
          fullName: project.path_with_namespace,
          description: project.description || "",
          webUrl: project.web_url,
          defaultBranch: project.default_branch,
          private: project.visibility === "private",
        }));
      },
      3,
      "getRepositories"
    );
  }

  async getBranches(repoId: string): Promise<GitBranchInfo[]> {
    if (!repoId) {
      throw new Error("Repository ID is required");
    }
    
    return this.withRetry(
      async () => {
        const branches = await this.gitlab.Branches.all(repoId);

        return branches.map((branch) => ({
          id: branch.name,
          name: branch.name,
          protected: branch.protected,
        }));
      },
      3,
      "getBranches"
    );
  }

  async getMergeRequests(repoId: string): Promise<GitMergeRequestInfo[]> {
    if (!repoId) {
      throw new Error("Repository ID is required");
    }
    
    return this.withRetry(
      async () => {
        const mrs = await this.gitlab.MergeRequests.all({ projectId: repoId });

        return mrs.map((mr) => ({
          id: mr.iid,
          title: mr.title,
          description: mr.description || "",
          status: mr.state.toUpperCase() as "OPEN" | "MERGED" | "CLOSED",
          sourceBranch: mr.source_branch,
          targetBranch: mr.target_branch,
          author: mr.author?.username || "",
          assignee: mr.assignee?.username,
          reviewerIds: mr.reviewers?.map((r) => r.username) || [],
          labels: mr.labels || [],
          webUrl: mr.web_url,
          createdAt: new Date(mr.created_at),
          updatedAt: new Date(mr.updated_at),
          mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
          mergedBy: mr.merged_by?.username,
        }));
      },
      3,
      "getMergeRequests"
    );
  }

  async createMergeRequest(
    repoId: string,
    data: any
  ): Promise<GitMergeRequestInfo> {
    if (!repoId) {
      throw new Error("Repository ID is required");
    }
    
    return this.withRetry(
      async () => {
        const mr = await this.gitlab.MergeRequests.create(
          repoId,
          data.sourceBranch,
          data.targetBranch,
          data.title,
          {
            description: data.description,
          }
        );

        return {
          id: mr.iid,
          title: mr.title,
          description: mr.description || "",
          status: "OPEN" as const,
          sourceBranch: mr.source_branch,
          targetBranch: mr.target_branch,
          author: mr.author?.username || "",
          assignee: mr.assignee?.username,
          reviewerIds: [],
          labels: [],
          webUrl: mr.web_url,
          createdAt: new Date(mr.created_at),
          updatedAt: new Date(mr.updated_at),
        };
      },
      3,
      "createMergeRequest"
    );
  }

  async mergeMergeRequest(repoId: string, mrId: string): Promise<void> {
    if (!repoId || !mrId) {
      throw new Error("Repository ID and Merge Request ID are required");
    }
    
    await this.withRetry(
      async () => {
        await this.gitlab.MergeRequests.accept(repoId, parseInt(mrId));
      },
      3,
      "mergeMergeRequest"
    );
  }

  async closeMergeRequest(repoId: string, mrId: string): Promise<void> {
    if (!repoId || !mrId) {
      throw new Error("Repository ID and Merge Request ID are required");
    }
    
    await this.withRetry(
      async () => {
        await this.gitlab.MergeRequests.edit(repoId, parseInt(mrId), {
          state_event: "close",
        });
      },
      3,
      "closeMergeRequest"
    );
  }
}
