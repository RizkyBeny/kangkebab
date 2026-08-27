import { EventEmitter } from 'events';

class SSEBroadcaster extends EventEmitter {}

// Global singleton to prevent loss of events across HMR in Next.js dev
const globalForSSE = globalThis as unknown as {
  sseBroadcaster: SSEBroadcaster | undefined;
};

export const sseBroadcaster = globalForSSE.sseBroadcaster ?? new SSEBroadcaster();
if (process.env.NODE_ENV !== 'production') globalForSSE.sseBroadcaster = sseBroadcaster;
