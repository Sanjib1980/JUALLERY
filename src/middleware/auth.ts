import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { carts, customers, profiles, userRoles } from '../db/schema.ts';

const OWNER_EMAIL = 'iaitkaliabor@gmail.com';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SQL_PASSWORD ||
  'aurelia-heritage-jewels-session-secret-key';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  mobile: string;
  roles: string[];
  activeRole: 'customer' | 'shopkeeper' | 'super_admin';
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function signSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `app_${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  try {
    if (!token.startsWith('app_')) return null;
    const raw = token.slice(4);
    const [payload, sig] = raw.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.uid || Date.now() > parsed.exp) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

export async function loadAuthUserById(userId: string): Promise<AuthenticatedUser | null> {
  const [prof] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!prof || !prof.isActive) return null;

  const roleRows = await db.select().from(userRoles).where(eq(userRoles.userId, prof.id));
  const roles = roleRows.map((r) => r.role);
  const activeRole: 'customer' | 'shopkeeper' | 'super_admin' = roles.includes('super_admin')
    ? 'super_admin'
    : roles.includes('shopkeeper')
    ? 'shopkeeper'
    : 'customer';

  return {
    id: prof.id,
    email: prof.email,
    fullName: prof.fullName,
    mobile: prof.mobile,
    roles: roles.length ? roles : ['customer'],
    activeRole,
  };
}

export async function syncFirebaseUserToDb(decoded: {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}): Promise<AuthenticatedUser> {
  const email = (decoded.email || `${decoded.uid}@user.local`).toLowerCase();
  const fullName = decoded.name || email.split('@')[0] || 'Valued Guest';

  let [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.firebaseUid, decoded.uid))
    .limit(1);

  if (!existing) {
    [existing] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  }

  let profileId: string;
  if (!existing) {
    const [inserted] = await db
      .insert(profiles)
      .values({
        firebaseUid: decoded.uid,
        email,
        fullName,
        avatarUrl: decoded.picture || null,
      })
      .onConflictDoUpdate({
        target: profiles.email,
        set: { firebaseUid: decoded.uid, updatedAt: new Date() },
      })
      .returning();
    profileId = inserted.id;
  } else {
    profileId = existing.id;
    if (!existing.firebaseUid) {
      await db
        .update(profiles)
        .set({ firebaseUid: decoded.uid, updatedAt: new Date() })
        .where(eq(profiles.id, profileId));
    }
  }

  await db
    .insert(userRoles)
    .values({ userId: profileId, role: 'customer' })
    .onConflictDoNothing();

  // Bootstrap super_admin for app owner or if no super_admin exists yet
  const existingAdmins = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.role, 'super_admin'))
    .limit(1);

  if (email === OWNER_EMAIL || existingAdmins.length === 0) {
    await db
      .insert(userRoles)
      .values({ userId: profileId, role: 'super_admin' })
      .onConflictDoNothing();
  }

  await db.insert(customers).values({ userId: profileId }).onConflictDoNothing();
  await db.insert(carts).values({ userId: profileId }).onConflictDoNothing();

  const authUser = await loadAuthUserById(profileId);
  if (!authUser) throw new Error('Account is inactive or unavailable');
  return authUser;
}

export async function resolveAuthUser(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  const cookies = parseCookies(req.headers.cookie);
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const sessionToken =
    bearerToken?.startsWith('app_') ? bearerToken : cookies['aurelia_session'] || null;

  if (sessionToken) {
    const uid = verifySessionToken(sessionToken);
    if (uid) {
      return await loadAuthUserById(uid);
    }
  }

  if (bearerToken && !bearerToken.startsWith('app_')) {
    try {
      const decoded = await adminAuth.verifyIdToken(bearerToken);
      return await syncFirebaseUserToDb({
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      });
    } catch {
      return null;
    }
  }

  return null;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.authUser = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Unauthorized session' });
  }
};

export const requireStaff = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, () => {
    if (!req.authUser || !['shopkeeper', 'super_admin'].includes(req.authUser.activeRole)) {
      return res.status(403).json({ error: 'Forbidden: Shopkeeper or Admin access required.' });
    }
    next();
  });
};

export const requireSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, () => {
    if (!req.authUser || req.authUser.activeRole !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required.' });
    }
    next();
  });
};
