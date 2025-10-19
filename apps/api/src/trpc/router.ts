import { usersRouter } from "../features/users/users.router";
import { authRouter } from "./routers/auth";
import { router } from "./trpc";

export const appRouter = router({
  users: usersRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
