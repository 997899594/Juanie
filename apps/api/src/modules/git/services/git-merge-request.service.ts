import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type { DrizzleService } from "../../../drizzle/drizzle.service";
import {
  type MergeRequest as GitMergeRequest,
  mergeRequests as gitMergeRequests,
  gitRepositories,
} from "../../../drizzle/schemas";
import type { GitProviderFactory } from "../providers/git-provider.factory";

interface CreateMergeRequestInput {
  repositoryId: string;
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
  assigneeId?: string;
  reviewerIds?: string[];
  labels?: string[];
}

interface GetMergeRequestsInput {
  repositoryId: string;
  status?: "OPEN" | "MERGED" | "CLOSED" | "DRAFT";
  page: number;
  limit: number;
}

interface MergeRequestListResult {
  mergeRequests: GitMergeRequest[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class GitMergeRequestService {
  constructor(
    private readonly db: DrizzleService,
    private readonly gitProviderFactory: GitProviderFactory
  ) {}

  async createMergeRequest(
    input: CreateMergeRequestInput,
    userId: string
  ): Promise<GitMergeRequest> {
    const {
      repositoryId,
      title,
      description,
      sourceBranch,
      targetBranch,
      assigneeId,
      reviewerIds,
      labels,
    } = input;

    try {
      // 获取仓库信息
      const repo = await this.getRepository(repositoryId);
      const provider = this.gitProviderFactory.create(
        repo.provider,
        repo.accessToken!
      );

      // 在远程创建合并请求
      const mrInfo = await provider.createMergeRequest(repo.repoId, {
        title,
        description: description || "",
        sourceBranch,
        targetBranch,
        assigneeId,
        reviewerIds,
        labels,
      });

      // 保存到本地数据库
      const [newMr] = await this.db.drizzle
        .insert(gitMergeRequests)
        .values({
          repositoryId,
          mrId: mrInfo.id,
          title,
          description: description || "",
          sourceBranch,
          targetBranch,
          status: "OPEN",
          url: mrInfo.url,
          assigneeId,
          reviewerIds: reviewerIds || [],
          labels: labels || [],
          createdBy: userId,
        })
        .returning();

      return newMr;
    } catch (error) {
      throw new Error(`Failed to create merge request: ${error.message}`);
    }
  }

  async getMergeRequests(
    input: GetMergeRequestsInput
  ): Promise<MergeRequestListResult> {
    const { repositoryId, status, page, limit } = input;
    const offset = (page - 1) * limit;

    let query = this.db.drizzle
      .select()
      .from(gitMergeRequests)
      .where(eq(gitMergeRequests.repositoryId, repositoryId));

    if (status) {
      query = query.where(eq(gitMergeRequests.status, status));
    }

    const mergeRequests = await query
      .limit(limit)
      .offset(offset)
      .orderBy(desc(gitMergeRequests.createdAt));

    // 获取总数
    let countQuery = this.db.drizzle
      .select({ count: gitMergeRequests.id })
      .from(gitMergeRequests)
      .where(eq(gitMergeRequests.repositoryId, repositoryId));

    if (status) {
      countQuery = countQuery.where(eq(gitMergeRequests.status, status));
    }

    const [{ count }] = await countQuery;

    return {
      mergeRequests,
      total: Number(count),
      page,
      limit,
    };
  }

  async getMergeRequest(
    repositoryId: string,
    mrId: string
  ): Promise<GitMergeRequest | null> {
    const [mr] = await this.db.drizzle
      .select()
      .from(gitMergeRequests)
      .where(
        and(
          eq(gitMergeRequests.repositoryId, repositoryId),
          eq(gitMergeRequests.mrId, mrId)
        )
      )
      .limit(1);

    return mr || null;
  }

  async updateMergeRequestStatus(
    repositoryId: string,
    mrId: string,
    status: "OPEN" | "MERGED" | "CLOSED" | "DRAFT"
  ): Promise<void> {
    await this.db.drizzle
      .update(gitMergeRequests)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(gitMergeRequests.repositoryId, repositoryId),
          eq(gitMergeRequests.mrId, mrId)
        )
      );
  }

  async mergeMergeRequest(
    repositoryId: string,
    mrId: string,
    userId: string
  ): Promise<void> {
    try {
      const repo = await this.getRepository(repositoryId);
      const provider = this.gitProviderFactory.create(
        repo.provider,
        repo.accessToken!
      );

      // 在远程合并
      await provider.mergeMergeRequest(repo.repoId, mrId);

      // 更新本地状态
      await this.db.drizzle
        .update(gitMergeRequests)
        .set({
          status: "MERGED",
          mergedAt: new Date(),
          mergedBy: userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(gitMergeRequests.repositoryId, repositoryId),
            eq(gitMergeRequests.mrId, mrId)
          )
        );
    } catch (error) {
      throw new Error(`Failed to merge merge request: ${error.message}`);
    }
  }

  async closeMergeRequest(repositoryId: string, mrId: string): Promise<void> {
    try {
      const repo = await this.getRepository(repositoryId);
      const provider = this.gitProviderFactory.create(
        repo.provider,
        repo.accessToken!
      );

      // 在远程关闭
      await provider.closeMergeRequest(repo.repoId, mrId);

      // 更新本地状态
      await this.updateMergeRequestStatus(repositoryId, mrId, "CLOSED");
    } catch (error) {
      throw new Error(`Failed to close merge request: ${error.message}`);
    }
  }

  async syncMergeRequests(
    repositoryId: string
  ): Promise<{ synced: number; errors: string[] }> {
    const repo = await this.getRepository(repositoryId);
    const provider = this.gitProviderFactory.create(
      repo.provider,
      repo.accessToken!
    );

    try {
      const remoteMRs = await provider.getMergeRequests(repo.repoId);
      const errors: string[] = [];
      let synced = 0;

      for (const mr of remoteMRs) {
        try {
          await this.db.drizzle
            .insert(gitMergeRequests)
            .values({
              repositoryId,
              mrId: mr.id,
              title: mr.title,
              description: mr.description,
              sourceBranch: mr.sourceBranch,
              targetBranch: mr.targetBranch,
              status: mr.status as "OPEN" | "MERGED" | "CLOSED" | "DRAFT",
              url: mr.url,
              assigneeId: mr.assigneeId,
              reviewerIds: mr.reviewerIds || [],
              labels: mr.labels || [],
              mergedAt: mr.mergedAt,
              mergedBy: mr.mergedBy,
            })
            .onConflictDoUpdate({
              target: [gitMergeRequests.repositoryId, gitMergeRequests.mrId],
              set: {
                title: mr.title,
                description: mr.description,
                status: mr.status as "OPEN" | "MERGED" | "CLOSED" | "DRAFT",
                assigneeId: mr.assigneeId,
                reviewerIds: mr.reviewerIds || [],
                labels: mr.labels || [],
                mergedAt: mr.mergedAt,
                mergedBy: mr.mergedBy,
                updatedAt: new Date(),
              },
            });

          synced++;
        } catch (error) {
          errors.push(`Failed to sync MR ${mr.id}: ${error.message}`);
        }
      }

      return { synced, errors };
    } catch (error) {
      throw new Error(`Failed to sync merge requests: ${error.message}`);
    }
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
