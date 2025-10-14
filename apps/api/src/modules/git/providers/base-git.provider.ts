import { AppError } from '../../../lib/errors'
import type {
  GitBranchInfo,
  GitMergeRequestInfo,
  GitRepositoryInfo,
} from '../interfaces/git-provider.interface'

export abstract class BaseGitProvider {
  // 现代化错误处理
  protected handleApiError(error: unknown, operation: string): never {
    // Preserve already-wrapped AppError instances
    if (error instanceof AppError) {
      throw error
    }

    const err: any = error as any
    const message = err?.message ?? (typeof err === 'string' ? err : 'Unknown error')
    const metadata = {
      provider: this.providerName,
      operation,
      originalError: error,
      errorName: err?.name,
      errorStack: err?.stack,
    }

    throw AppError.internal(`${this.providerName} API error in ${operation}: ${message}`, metadata)
  }

  // 现代化重试逻辑
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    operationName = 'operation',
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        if (attempt === maxRetries) {
          this.handleApiError(error, operationName)
        }

        // 指数退避
        await new Promise((resolve) => setTimeout(resolve, Math.min(2 ** attempt * 1000, 10000)))
      }
    }

    // TypeScript 需要这个，虽然永远不会到达
    throw AppError.internal('Retry logic failed')
  }

  // 抽象方法
  abstract readonly providerName: string
  abstract getRepositories(): Promise<GitRepositoryInfo[]>
  abstract getBranches(repoId: string): Promise<GitBranchInfo[]>
  abstract getMergeRequests(repoId: string): Promise<GitMergeRequestInfo[]>
  abstract createMergeRequest(
    repoId: string,
    data: import('../../../lib/types/index').CreateMergeRequestData,
  ): Promise<GitMergeRequestInfo>
  abstract mergeMergeRequest(repoId: string, mrId: number): Promise<void>
  abstract closeMergeRequest(repoId: string, mrId: number): Promise<void>
}
