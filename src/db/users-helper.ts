import { db } from './index.ts';
import { users, members, validEmployeeIds, appSettings } from './schema.ts';
import { eq, count, sql } from 'drizzle-orm';

export interface DBUser {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  employeeIdVerified: boolean;
  pendingEmployeeId: string | null;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// UID prefix for stub records created at registration time (before first Supabase login)
export const PENDING_UID_PREFIX = 'pre-reg:';

export async function getOrCreateUser(uid: string, email: string, displayName?: string | null): Promise<DBUser> {
  try {
    // 1. Check if user already exists by UID
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const dbUser = existing[0] as DBUser;

      // Keep member profile linked — only auto-link if not requiring verification OR if user is already verified
      const existingValidIdsResult = await db.select({ value: count() }).from(validEmployeeIds);
      const existingRequiresVerification = existingValidIdsResult[0].value > 0;
      if (!existingRequiresVerification || dbUser.employeeIdVerified) {
        const matchedMember = await db.select().from(members).where(eq(members.email, email)).limit(1);
        if (matchedMember.length > 0 && !matchedMember[0].userId) {
          await db.update(members)
            .set({ userId: dbUser.id, updatedAt: new Date() })
            .where(eq(members.id, matchedMember[0].id));
        }
      }
      return dbUser;
    }

    // 1b. Check for a pre-registration stub with the same email (created during signup
    //     before Supabase issued a session). Merge the real UID into the stub.
    if (!uid.startsWith(PENDING_UID_PREFIX)) {
      const stub = await db.select().from(users)
        .where(eq(users.uid, `${PENDING_UID_PREFIX}${email}`))
        .limit(1);
      if (stub.length > 0) {
        const merged = await db.update(users)
          .set({ uid, updatedAt: new Date() })
          .where(eq(users.id, stub[0].id))
          .returning();
        return merged[0] as DBUser;
      }
    }

    // 2. Count only real (non-stub) users to determine if this is the first actual user
    const likePattern = PENDING_UID_PREFIX + '%';
    const realUserCountResult = await db.select({ value: count() }).from(users)
      .where(sql`uid NOT LIKE ${likePattern}`);
    const isFirstUser = realUserCountResult[0].value === 0 && !uid.startsWith(PENDING_UID_PREFIX);

    // First user becomes System Admin and is immediately active.
    // All subsequent users are pending admin approval.
    const assignedRole = isFirstUser ? 'System Admin' : 'Member';
    const initialActive = isFirstUser;
    const employeeIdVerified = isFirstUser; // Admin will link non-admin users to their employee record

    // 3. Insert new user record (existence already verified above via SELECT)
    const result = await db.insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        role: assignedRole,
        isActive: initialActive,
        employeeIdVerified,
      })
      .returning();

    const dbUser = result[0] as DBUser;

    // 4. For the first user (System Admin), auto-link member profile if one exists
    if (isFirstUser) {
      const matchedMember = await db.select().from(members).where(eq(members.email, email)).limit(1);
      if (matchedMember.length > 0 && !matchedMember[0].userId) {
        await db.update(members)
          .set({ userId: dbUser.id, updatedAt: new Date() })
          .where(eq(members.id, matchedMember[0].id));
      }
    }
    // Non-admin users: admin will link them to an employee record via the Users module.

    return dbUser;
  } catch (error) {
    console.error("Failed to get/create user in DB:", error);
    throw new Error("User profiles synchronization failed.", { cause: error });
  }
}
