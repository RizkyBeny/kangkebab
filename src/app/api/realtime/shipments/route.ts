import { sseBroadcaster } from '@/lib/sseEmitter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(payload));
      };

      // Initial heartbeat ping
      sendEvent({ type: 'PING', message: 'SSE Connection Established' });

      const onUpdate = (data: Record<string, unknown>) => {
        sendEvent(data);
      };

      sseBroadcaster.on('SHIPMENT_UPDATED', onUpdate);
      sseBroadcaster.on('SALES_UPDATED', onUpdate);

      request.signal.addEventListener('abort', () => {
        sseBroadcaster.off('SHIPMENT_UPDATED', onUpdate);
        sseBroadcaster.off('SALES_UPDATED', onUpdate);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
