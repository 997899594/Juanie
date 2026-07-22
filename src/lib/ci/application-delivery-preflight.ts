import { verifyApplicationDeliveryCapability } from '@/lib/ci/application-delivery';

const capability = await verifyApplicationDeliveryCapability();
console.info(
  `Application delivery capability verified for ${capability.repository}:${capability.workflow}`
);
