import { defineEventHandler, setHeader } from "h3";
import { HealthService } from "@/modules/health/services/health.service";
import { getNestApp } from "@/nest";

export default defineEventHandler(async (event) => {
  try {
    const app = await getNestApp();
    const healthService = app.get(HealthService);

    const health = await healthService.getHealthStatus();

    setHeader(event, "Content-Type", "application/json; charset=utf-8");
    return health;
  } catch (error) {
    setHeader(event, "Content-Type", "application/json; charset=utf-8");
    return {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Service unavailable",
    };
  }
});
