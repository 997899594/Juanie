import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'
import type { Queue } from 'bullmq'

export function setupBullBoard(pipelineQueue: Queue, deploymentQueue: Queue) {
  const serverAdapter = new FastifyAdapter()
  serverAdapter.setBasePath('/admin/queues')

  createBullBoard({
    queues: [new BullMQAdapter(pipelineQueue), new BullMQAdapter(deploymentQueue)],
    serverAdapter,
  })

  return serverAdapter
}
