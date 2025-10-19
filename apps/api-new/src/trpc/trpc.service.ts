import { Injectable } from "@nestjs/common";
import { initTRPC } from "@trpc/server";
import { DocumentsService } from "../documents/documents.service";
import { AuthService } from "../auth/auth.service";
import { createDocumentSchema } from "../schemas/document.schema";
import { createAuthRouter } from "./routers/auth.router";

const t = initTRPC.create();

@Injectable()
export class TrpcService {
  private _appRouter: ReturnType<typeof this.createAppRouter>;

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly authService: AuthService,
  ) {
    this._appRouter = this.createAppRouter();
  }

  private createAppRouter() {
    return t.router({
      // 认证相关路由
      auth: createAuthRouter(this.authService),
    
    // 文档相关路由
      createDocument: t.procedure
        .input(createDocumentSchema)
        .mutation(async ({ input }) => {
          return this.documentsService.createWithEmbedding(input);
        }),

      getDocument: t.procedure
        .input((input: unknown) => {
          if (typeof input !== "object" || input === null || !("id" in input)) {
            throw new Error("Invalid input: id is required");
          }
          const id = Number((input as any).id);
          if (isNaN(id)) {
            throw new Error("Invalid input: id must be a number");
          }
          return { id };
        })
        .query(async ({ input }) => {
          return this.documentsService.findById(input.id);
        }),

      getDocuments: t.procedure.query(async () => {
        return this.documentsService.findAll();
      }),
    });
  }

  get appRouter() {
    return this._appRouter;
  }

  get router() {
    return this.appRouter;
  }
}

export type AppRouter = TrpcService["appRouter"];
