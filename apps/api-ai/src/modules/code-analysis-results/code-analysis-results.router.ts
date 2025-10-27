import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { CodeAnalysisResultsService } from './code-analysis-results.service';
import { z } from 'zod';

@Injectable()
export class CodeAnalysisResultsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly codeAnalysisResultsService: CodeAnalysisResultsService,
  ) {}

  public get codeAnalysisResultsRouter() {
    return this.trpc.router({
      // TODO: Implement actual code analysis results management procedures here
      hello: this.trpc.publicProcedure
        .query(() => {
          return this.codeAnalysisResultsService.hello();
        }),
    });
  }
}