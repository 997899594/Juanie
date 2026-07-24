import { deploymentWorkflow } from '@/lib/deployments/workflows/deployment';
import { environmentRuntimeWorkflow } from '@/lib/environments/workflows/runtime';
import { migrationWorkflow } from '@/lib/migrations/workflows/migration';
import { projectDeletionWorkflow } from '@/lib/projects/workflows/project-delete';
import { projectInitializationWorkflow } from '@/lib/projects/workflows/project-init';
import { releaseWorkflow } from '@/lib/releases/workflows/release';
import { schemaRepairWorkflow } from '@/lib/schema-management/workflows/schema-repair';
import { sourceDeliveryWorkflow } from '@/lib/source-deliveries/workflows/source-delivery';
import { sourceWebhookController } from '@/lib/source-deliveries/workflows/webhook-controller';

export const restateServices = [
  projectInitializationWorkflow,
  releaseWorkflow,
  environmentRuntimeWorkflow,
  migrationWorkflow,
  deploymentWorkflow,
  projectDeletionWorkflow,
  schemaRepairWorkflow,
  sourceDeliveryWorkflow,
  sourceWebhookController,
];
