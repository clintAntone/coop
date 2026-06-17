import { createApp } from '../server.ts';

// Cache the app instance across warm invocations
let app: Awaited<ReturnType<typeof createApp>> | null = null;

export default async function handler(req: any, res: any) {
  if (!app) {
    app = await createApp();
  }
  return app(req, res);
}
