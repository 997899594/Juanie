import { All, Controller, Req, Res } from "@nestjs/common";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TrpcRouter } from "./trpc.router";
import { TrpcService } from "./trpc.service";

@Controller("trpc")
export class TrpcController {
  constructor(
    private readonly trpcRouter: TrpcRouter,
    private readonly trpcService: TrpcService
  ) {}

  @All("*")
  async handle(@Req() req: any, @Res() res: any) {
    const response = await fetchRequestHandler({
      endpoint: "/trpc",
      req: new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body:
          req.method !== "GET" && req.method !== "HEAD"
            ? JSON.stringify(req.body)
            : undefined,
      }),
      router: this.trpcRouter.appRouter,
      createContext: () => this.trpcService.createContext({ req, res }),
    });

    const body = await response.text();
    res.status(response.status);
    // biome-ignore lint/suspicious/useIterableCallbackReturn: <explanation>
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(body);
  }
}
