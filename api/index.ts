import { createApp } from '../server.js';

// Cache the app instance across warm invocations
let app: Awaited<ReturnType<typeof createApp>> | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!app) {
      app = await createApp();
    }
    return app(req, res);
  } catch (err: any) {
    console.error('[handler] Fatal error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Server initialization failed', detail: err?.message });
  }
}
