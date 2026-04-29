const encoder = new TextEncoder();

export interface SafeSSEWriter {
  send(data: object): boolean;
  close(): void;
  isClosed(): boolean;
}

export function createSafeSSEWriter(
  controller: ReadableStreamDefaultController<Uint8Array>
): SafeSSEWriter {
  let closed = false;

  return {
    send(data: object) {
      if (closed) {
        return false;
      }

      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        return true;
      } catch {
        closed = true;
        return false;
      }
    },
    close() {
      if (closed) {
        return;
      }

      closed = true;

      try {
        controller.close();
      } catch {
        // The client may have disconnected between the last write and close.
      }
    },
    isClosed() {
      return closed;
    },
  };
}

export const sseResponseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;
