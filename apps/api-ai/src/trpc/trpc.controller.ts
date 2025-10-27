import { All, Controller, Req, Res } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { TrpcRouter } from './trpc.router';

@Controller('trpc')
export class TrpcController {
  private appRouter: ReturnType<TrpcRouter['appRouter']>;

  constructor(
    private readonly trpcService: TrpcService,
    private readonly trpcRouter: TrpcRouter,
  ) {
    this.appRouter = this.trpcRouter.appRouter;
  }

  @All('*')
  async handle(@Req() req: any, @Res() res: any) {
    const path = req.url.replace('/trpc/', '');
    const context = this.trpcService.createContext({ req, res });

    try {
      const caller = this.appRouter.createCaller(context);
      const [procedure, method] = path.split('.');
      
      if (!procedure || !method) {
        throw new Error('Invalid procedure path');
      }

      // 对于 void 输入，传递 undefined 而不是空对象
      const input = req.method === 'POST' && req.body?.input !== undefined 
        ? req.body.input 
        : undefined;
      
      const result = await caller[procedure][method](input);
      
      res.json({
        result: {
          data: {
            json: result
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
}