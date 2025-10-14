import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { DrizzleService } from "../../../drizzle/drizzle.service";
import {
  type GitBranch,
  gitBranches,
  gitRepositories,
  type NewGitBranch,
} from "../../../drizzle/schemas";
import type { GitProviderFactory } from "../providers/git-provider.factory";

@Injectable()
export class GitBranchService {
  constructor(
    private readonly db: DrizzleService,
    private readonly gitProviderFactory: GitProviderFactory
  ) {}

  async createBranch(
    repositoryId: string,
    branchName: string,
    sourceBranch: string = "main",
    userId?: string
  ): Promise<GitBranch> {
    const repo = await this.getRepository(repositoryId);
    const provider = this.gitProviderFactory.create(
      repo.provider,
      repo.accessToken!
    );

    try {
      // 在远程创建分支
      const branchInfo = await provider.createBranch(
        repo.repoId,
        branchName,
        sourceBranch
      );

      // 保存到本地数据库
      const [newBranch] = await this.db.drizzle
        .insert(gitBranches)
        .values({
          repositoryId,
          name: branchName,
          sha: branchInfo.sha,
          status: "ACTIVE",
          isProtected: branchInfo.protected,
          isDefault: branchInfo.default,
          lastCommit: branchInfo.lastCommit
            ? {
                sha: branchInfo.lastCommit.sha,
                message: branchInfo.lastCommit.message,
                author: branchInfo.lastCommit.author,
                date: branchInfo.lastCommit.date.toISOString(),
              }
            : undefined,
          createdBy: userId,
        })
        .returning();

      return newBranch;
    } catch (error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  async deleteBranch(repositoryId: string, branchName: string): Promise<void> {
    const repo = await this.getRepository(repositoryId);
    const provider = this.gitProviderFactory.create(
      repo.provider,
      repo.accessToken!
    );

    try {
      // 从远程删除分支
      await provider.deleteBranch(repo.repoId, branchName);

      // 更新本地状态
      await this.db.drizzle
        .update(gitBranches)
        .set({
          status: "DELETED",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(gitBranches.repositoryId, repositoryId),
            eq(gitBranches.name, branchName)
          )
        );
    } catch (error) {
      throw new Error(`Failed to delete branch: ${error.message}`);
    }
  }

  async syncBranches(
    repositoryId: string
  ): Promise<{ synced: number; errors: string[] }> {
    const repo = await this.getRepository(repositoryId);
    const provider = this.gitProviderFactory.create(
      repo.provider,
      repo.accessToken!
    );

    try {
      const remoteBranches = await provider.getBranches(repo.repoId);
      const errors: string[] = [];
      let synced = 0;

      for (const branch of remoteBranches) {
        try {
          await this.db.drizzle
            .insert(gitBranches)
            .values({
              repositoryId,
              name: branch.name,
              sha: branch.sha,
              status: "ACTIVE",
              isProtected: branch.protected,
              isDefault: branch.default,
              lastCommit: branch.lastCommit
                ? {
                    sha: branch.lastCommit.sha,
                    message: branch.lastCommit.message,
                    author: branch.lastCommit.author,
                    date: branch.lastCommit.date.toISOString(),
                  }
                : undefined,
            })
            .onConflictDoUpdate({
              target: [gitBranches.repositoryId, gitBranches.name],
              set: {
                sha: branch.sha,
                isProtected: branch.protected,
                isDefault: branch.default,
                lastCommit: branch.lastCommit
                  ? {
                      sha: branch.lastCommit.sha,
                      message: branch.lastCommit.message,
                      author: branch.lastCommit.author,
                      date: branch.lastCommit.date.toISOString(),
                    }
                  : undefined,
                updatedAt: new Date(),
              },
            });

          synced++;
        } catch (error) {
          errors.push(`Failed to sync branch ${branch.name}: ${error.message}`);
        }
      }

      // 更新仓库的最后同步时间
      await this.db.drizzle
        .update(gitRepositories)
        .set({ lastSyncAt: new Date() })
        .where(eq(gitRepositories.id, repositoryId));

      return { synced, errors };
    } catch (error) {
      throw new Error(`Failed to sync branches: ${error.message}`);
    }
  }

  async getBranches(repositoryId: string): Promise<GitBranch[]> {
    return await this.db.drizzle
      .select()
      .from(gitBranches)
      .where(eq(gitBranches.repositoryId, repositoryId));
  }

  private async getRepository(repositoryId: string) {
    const [repo] = await this.db.drizzle
      .select()
      .from(gitRepositories)
      .where(eq(gitRepositories.id, repositoryId))
      .limit(1);

    if (!repo) {
      throw new Error("Repository not found");
    }

    return repo;
  }
}
