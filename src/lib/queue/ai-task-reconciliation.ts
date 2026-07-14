import { Cron } from 'croner';
import { reconcileAITasks } from '@/lib/ai/tasks/reconciler';
import { logger } from '@/lib/logger';

const schedule = process.env.AI_TASK_RECONCILIATION_SCHEDULE?.trim() || '* * * * *';
const reconciliationLogger = logger.child({ component: 'ai-task-reconciliation' });
let started = false;

async function reconcile(): Promise<void> {
  try {
    const result = await reconcileAITasks();
    if (result.discovered > 0) {
      reconciliationLogger.info('AI task reconciliation completed', {
        discovered: result.discovered,
        dispatched: result.dispatched,
        failed: result.failed,
      });
    }
  } catch (error) {
    reconciliationLogger.error('AI task reconciliation failed', error);
  }
}

export function startAITaskReconciliation(): void {
  if (started) return;
  started = true;
  void reconcile();
  new Cron(schedule, reconcile);
}
