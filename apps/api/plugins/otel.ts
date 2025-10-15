import { defineNitroPlugin } from "nitropack/runtime";
import { config } from "@/lib/nitro-config";

export default defineNitroPlugin(async (nitroApp) => {
  if (!config.tracing.enabled) {
    return;
  }

  console.log(
    `OpenTelemetry enabled for service: ${config.tracing.serviceName}`
  );

  if (config.tracing.endpoint) {
    console.log(`OTLP endpoint: ${config.tracing.endpoint}`);
  }

  // 这里可以添加实际的 OpenTelemetry 初始化代码
  // 例如：
  // const { NodeSDK } = await import('@opentelemetry/sdk-node');
  // const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  //
  // const sdk = new NodeSDK({
  //   serviceName: config.tracing.serviceName,
  //   instrumentations: [getNodeAutoInstrumentations()],
  // });
  //
  // sdk.start();
});
