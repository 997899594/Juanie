import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { GitService } from "@/modules/git/services/git.service";
import { getNestApp } from "@/nest";

export default defineEventHandler(async (event) => {
  try {
    const app = await getNestApp();
    const gitService = app.get(GitService);

    const provider = getRouterParam(event, "provider");
    if (!provider || !["github", "gitlab"].includes(provider)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid provider",
      });
    }

    const payload = await readBody(event);

    // 处理 webhook 事件
    await gitService.webhooks.handleWebhookEvent(
      provider.toUpperCase(),
      payload
    );

    return { success: true };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }
});
