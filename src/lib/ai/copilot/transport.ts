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
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) {
          return false;
        }

        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          closed = true;
          return false;
        }
      };
      const safeClose = () => {
        if (closed) {
          return;
        }

        closed = true;
        try {
          controller.close();
        } catch {
          // The client may already have closed the HTTP stream.
        }
      };

      if (!safeEnqueue(encodeSseEvent('meta', input.metadata))) {
        return;
      }

      const reader = input.textStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          if (value) {
            if (!safeEnqueue(encodeSseEvent('delta', { text: value }))) {
              break;
            }
          }
        }

        safeEnqueue(encodeSseEvent('done', { completed: true }));
        safeClose();
      } catch (error) {
        safeEnqueue(
          encodeSseEvent('error', {
            message: error instanceof Error ? error.message : 'Copilot stream failed',
          })
        );
        safeClose();
      } finally {
        reader.releaseLock();
      }
    },
  });
}
