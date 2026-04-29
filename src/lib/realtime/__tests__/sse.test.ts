import { describe, expect, it } from 'bun:test';
import { createSafeSSEWriter } from '@/lib/realtime/sse';

function createTestStream() {
  let writer!: ReturnType<typeof createSafeSSEWriter>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      writer = createSafeSSEWriter(controller);
    },
  });

  return { stream, writer };
}

describe('safe SSE writer', () => {
  it('encodes events and closes idempotently', async () => {
    const { stream, writer } = createTestStream();
    const reader = stream.getReader();

    expect(writer.send({ type: 'connected' })).toBe(true);

    const event = await reader.read();
    expect(new TextDecoder().decode(event.value)).toBe('data: {"type":"connected"}\n\n');

    writer.close();
    writer.close();

    expect(await reader.read()).toEqual({ done: true, value: undefined });
    expect(writer.send({ type: 'late' })).toBe(false);
  });

  it('swallows writes after the client disconnects', async () => {
    const { stream, writer } = createTestStream();
    const reader = stream.getReader();

    await reader.cancel();

    expect(writer.send({ type: 'late' })).toBe(false);
    expect(() => writer.close()).not.toThrow();
  });
});
