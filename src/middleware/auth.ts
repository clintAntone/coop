import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getOrCreateUser, DBUser } from '../db/users-helper.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  supabaseUser?: any;
  dbUser?: DBUser;
}

// ---------------------------------------------------------------------------
// JWKS-based JWT verification (works with both ECC P-256 and legacy HS256)
// Fetches Supabase's public keys once and caches them — no session lookup,
// no "Auth session missing!" errors.
// ---------------------------------------------------------------------------
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (jwksCache) return jwksCache;
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const url = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  if (!url || url.includes('placeholder') || url.startsWith('your-')) return null;
  jwksCache = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  return jwksCache;
}

// ---------------------------------------------------------------------------
// Fallback: Supabase client (used if JWKS URL is not resolvable)
// ---------------------------------------------------------------------------
let supabaseServerInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseServer() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = rawUrl ? (rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl) : '';
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;

  const isDummy = key.startsWith('your-') || key.includes('placeholder') || key === 'undefined';
  if (isDummy || key.split('.').length !== 3) return null;

  if (!supabaseServerInstance) {
    supabaseServerInstance = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return supabaseServerInstance;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token headers' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 0. PIN token — for manually-created employee accounts
  if (token.startsWith('pin-token-')) {
    try {
      const parts = token.replace('pin-token-', '').split('|');
      const uid = parts[0];
      const found = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (!found.length) return res.status(401).json({ error: 'Invalid PIN token.' });
      const u = found[0];
      if (!u.isActive && req.path !== '/api/me') {
        return res.status(403).json({ error: 'Account suspended.' });
      }
      req.dbUser = u as DBUser;
      return next();
    } catch (err: any) {
      return res.status(401).json({ error: 'PIN token validation failed.' });
    }
  }

  // 1. Mock mode bypass
  if (token.startsWith('mock-token-')) {
    try {
      const parts = token.replace('mock-token-', '').split('|');
      const role = parts[0] || 'Member';
      const email = parts[1] || 'mock@coop.local';
      const name = decodeURIComponent(parts[2] || email.split('@')[0]);
      const uid = `mock-uid-${email}`;

      const dbUser = await getOrCreateUser(uid, email, name);
      if (dbUser.role !== role) dbUser.role = role;
      if (!dbUser.isActive) dbUser.isActive = true;

      req.supabaseUser = { id: uid, email };
      req.dbUser = dbUser;
      return next();
    } catch (err: any) {
      console.error('Mock auth error:', err);
      return res.status(401).json({ error: 'Mock authentication parsing failed.' });
    }
  }

  // 2. JWKS verification — verifies signature locally using Supabase's public keys.
  //    Works with ECC P-256 (current) and legacy HS256. No session lookup needed.
  const jwks = getJWKS();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks);

      const uid = payload.sub!;
      const email = (payload as any).email || '';
      const meta = (payload as any).user_metadata || {};
      const name = meta.full_name || meta.display_name || email.split('@')[0] || '';

      const dbUser = await getOrCreateUser(uid, email, name);

      if (!dbUser.isActive && req.path !== '/api/me' && req.originalUrl !== '/api/me') {
        return res.status(403).json({
          error: 'Access Denied: Your account is pending administrator approval or has been deactivated.'
        });
      }

      req.supabaseUser = { id: uid, email };
      req.dbUser = dbUser;
      return next();
    } catch (err: any) {
      return res.status(401).json({ error: `Unauthorized: ${err.message}` });
    }
  }

  // 3. Fallback: Supabase getUser() (when SUPABASE_URL is not configured)
  const supabase = getSupabaseServer();
  if (!supabase) {
    return res.status(503).json({
      error: 'Auth not configured. Set SUPABASE_URL + SUPABASE_ANON_KEY in your environment.'
    });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: ' + (error?.message || 'Invalid token') });
    }

    req.supabaseUser = user;
    const name = user.user_metadata?.full_name || user.user_metadata?.display_name || user.email?.split('@')[0] || '';
    const dbUser = await getOrCreateUser(user.id, user.email || '', name);

    if (!dbUser.isActive && req.path !== '/api/me' && req.originalUrl !== '/api/me') {
      return res.status(403).json({
        error: 'Access Denied: Your account is pending administrator approval or has been deactivated.'
      });
    }

    req.dbUser = dbUser;
    next();
  } catch (error: any) {
    console.error('Supabase getUser error:', error);
    return res.status(401).json({ error: 'Unauthorized: Auth token validation failed' });
  }
};
