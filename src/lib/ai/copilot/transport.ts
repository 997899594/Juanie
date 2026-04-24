import type { CopilotSessionMetadata } from '@/lib/ai/copilot/types';

const encoder = new TextEncoder();

export type CopilotTransportMetadata = CopilotSessionMetadata;

export interface CopilotTransportEventMap {
  meta: CopilotTransportMetadata;
  delta: { text: string };
  done: { completed: true };
  error: { message: string };
}

type CopilotTransportEventName = keyof CopilotTransportEventMap;

function encodeSseEvent<TEventName extends CopilotTransportEventName>(
  event: TEventName,
  payload: CopilotTransportEventMap[TEventName]
): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export function createCopilotEventStream(input: {
  metadata: CopilotTransportMetadata;
  textStream: ReadableStream<string>;
}): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encodeSseEvent('meta', input.metadata));

      const reader = input.textStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          if (value) {
            controller.enqueue(encodeSseEvent('delta', { text: value }));
          }
        }

        controller.enqueue(encodeSseEvent('done', { completed: true }));
        controller.close();
      } catch (error) {
        controller.enqueue(
          encodeSseEvent('error', {
            message: error instanceof Error ? error.message : 'Copilot stream failed',
          })
        );
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });
}
