import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import {
  users,
  members,
  transactions,
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
  auditLogs,
  appSettings,
  validEmployeeIds,
  membershipTypes,
  membershipStatuses,
  savingsProducts,
  loanProducts,
  loanApprovalMatrix,
  departments,
} from './src/db/schema.ts';
import {
  seedChartOfAccounts,
  seedAppSettings,
  createAndPostTransaction,
  calculateMemberBalances,
  reverseTransaction,
} from './src/db/transaction-processor.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { PENDING_UID_PREFIX } from './src/db/users-helper.ts';
import { eq, and, desc, asc, sql, like, or, count } from 'drizzle-orm';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;

  app.use(express.json({ limit: '10mb' }));

  // 1. Seed Chart of Accounts on startup
  await seedChartOfAccounts();
  await seedAppSettings();

  // --- API Routes Definition ---

  // Public: validate an employee ID during registration — returns name if found and unclaimed.
  app.get('/api/check-employee-id/:id', async (req, res) => {
    try {
      const empId = req.params.id.trim();
      if (!empId) return res.status(400).json({ error: 'Employee ID is required.' });

      const entry = await db.select().from(validEmployeeIds)
        .where(eq(validEmployeeIds.employeeId, empId))
        .limit(1);

      if (entry.length === 0) {
        return res.json({ found: false, reason: 'not_found' });
      }
      if (entry[0].isClaimed) {
        return res.json({ found: false, reason: 'already_claimed' });
      }

      const fullName = [entry[0].firstName, entry[0].middleName, entry[0].lastName]
        .filter(Boolean).join(' ');
      res.json({ found: true, fullName, employeeId: empId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a pending stub user record at registration time (unauthenticated).
  // New flow: employee provides their Employee ID during signup so the admin can
  // immediately identify who is requesting access — no manual linking needed.
  // Legacy flow (no employeeId): still supported for backward compatibility.
  app.post('/api/users/pre-register', async (req, res) => {
    try {
      const { email, employeeId } = req.body;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required.' });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const stubUid = `${PENDING_UID_PREFIX}${normalizedEmail}`;

      // Check if a real user with this email already exists
      const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
      if (existing.length > 0 && !existing[0].uid.startsWith(PENDING_UID_PREFIX)) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      let displayName = normalizedEmail.split('@')[0];
      let pendingEmployeeId: string | null = null;

      // If an employee ID was provided, validate it and pull the name from the roster
      if (employeeId) {
        const empIdTrimmed = employeeId.trim();
        const rosterEntry = await db.select().from(validEmployeeIds)
          .where(and(eq(validEmployeeIds.employeeId, empIdTrimmed), eq(validEmployeeIds.isClaimed, false)))
          .limit(1);

        if (rosterEntry.length === 0) {
          return res.status(400).json({ error: 'Employee ID not found or already claimed.' });
        }

        pendingEmployeeId = empIdTrimmed;
        displayName = [rosterEntry[0].firstName, rosterEntry[0].middleName, rosterEntry[0].lastName]
          .filter(Boolean).join(' ') || displayName;
      }

      // Upsert the stub (idempotent — safe to call multiple times)
      await db.insert(users).values({
        uid: stubUid,
        email: normalizedEmail,
        displayName,
        role: 'Member',
        isActive: false,
        employeeIdVerified: false,
        pendingEmployeeId,
      }).onConflictDoNothing();

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get current authenticated user details
  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      res.json(req.dbUser);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update own profile (all roles)
  app.put('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      const { displayName, firstName, lastName, phone, department, avatarUrl } = req.body;
      const isMember = caller.role === 'Member';

      const userUpdates: any = { updatedAt: new Date() };
      if (!isMember && displayName !== undefined) userUpdates.displayName = displayName || caller.displayName;
      if (phone !== undefined) userUpdates.phone = phone;
      if (avatarUrl !== undefined) userUpdates.avatarUrl = avatarUrl;

      const [updatedUser] = await db.update(users)
        .set(userUpdates)
        .where(eq(users.id, caller.id))
        .returning();

      const linkedMember = await db.select().from(members).where(eq(members.userId, caller.id)).limit(1);
      if (linkedMember.length > 0) {
        const memberUpdates: any = { updatedAt: new Date() };
        if (!isMember) {
          if (firstName) memberUpdates.firstName = firstName;
          if (lastName) memberUpdates.lastName = lastName;
          if (department !== undefined) memberUpdates.department = department;
        }
        // Sync phone to member profile as well
        if (phone !== undefined) memberUpdates.phone = phone;

        await db.update(members).set(memberUpdates).where(eq(members.id, linkedMember[0].id));
      }

      await db.insert(auditLogs).values({
        userId: caller.id,
        action: 'UPDATE_OWN_PROFILE',
        details: `User ID ${caller.id} updated their own profile`,
      });

      res.json(updatedUser);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Link employee ID to own account (for new user verification)
  app.post('/api/me/link-employee-id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      const { employeeId } = req.body;
      if (!employeeId) return res.status(400).json({ error: 'Employee ID is required.' });

      const validId = await db.select().from(validEmployeeIds)
        .where(and(eq(validEmployeeIds.employeeId, employeeId.trim()), eq(validEmployeeIds.isClaimed, false)))
        .limit(1);

      if (validId.length === 0) {
        return res.status(400).json({ error: 'Invalid or already claimed employee ID.' });
      }

      const memberProfile = await db.select().from(members).where(eq(members.employeeId, employeeId.trim())).limit(1);
      if (memberProfile.length > 0 && !memberProfile[0].userId) {
        await db.update(members).set({ userId: caller.id, updatedAt: new Date() }).where(eq(members.id, memberProfile[0].id));
      }

      await db.update(validEmployeeIds)
        .set({ isClaimed: true, claimedByUserId: caller.id })
        .where(eq(validEmployeeIds.employeeId, employeeId.trim()));

      const [updated] = await db.update(users)
        .set({ employeeIdVerified: true, updatedAt: new Date() })
        .where(eq(users.id, caller.id))
        .returning();

      await db.insert(auditLogs).values({
        userId: caller.id,
        action: 'EMPLOYEE_ID_VERIFIED',
        details: `User ID ${caller.id} verified with employee ID ${employeeId}`,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get approved users who don't yet have a member profile — for the member registration form
  app.get('/api/users/eligible-for-member', requireAuth, async (req: AuthRequest, res) => {
    try {
      const callerRole = req.dbUser?.role;
      if (callerRole !== 'System Admin' && callerRole !== 'Manager') {
        return res.status(403).json({ error: 'Access Denied' });
      }

      // All active users are eligible — employeeIdVerified is not required
      // (mock users and legacy users may have it false but are still valid people)
      const activeUsers = await db.select().from(users)
        .where(eq(users.isActive, true))
        .orderBy(asc(users.displayName));

      // Exclude users whose email or userId is already linked to a member profile
      const existingMembers = await db.select({ email: members.email, userId: members.userId }).from(members);
      const memberEmails = new Set(existingMembers.map(m => m.email.toLowerCase()));
      const memberUserIds = new Set(existingMembers.filter(m => m.userId).map(m => m.userId));

      // Build roster lookup: prefer claimedByUserId, fall back to email match
      const allRosterEntries = await db.select().from(validEmployeeIds);
      const rosterByUserId = new Map(
        allRosterEntries.filter(e => e.claimedByUserId).map(e => [e.claimedByUserId, e])
      );
      const rosterByEmail = new Map(
        allRosterEntries.map(e => {
          // Infer email from claimedByUserId → look up user (done below), or match by pending_employee_id
          return [e.employeeId, e];
        })
      );
      // Build email→roster map from users that have pendingEmployeeId (pre-registration)
      const rosterByUserEmail = new Map<string, typeof allRosterEntries[0]>();
      for (const entry of allRosterEntries) {
        // We'll match by user email after filtering
      }

      const eligible = activeUsers
        .filter(u =>
          !u.uid.startsWith('pre-reg:') &&          // exclude unconfirmed stubs
          !memberEmails.has(u.email.toLowerCase()) &&
          !memberUserIds.has(u.id)
        )
        .map(u => {
          // Try claimedByUserId first, then fall back to pendingEmployeeId on user record
          const rosterById = rosterByUserId.get(u.id);
          const pendingEmpId = (u as any).pendingEmployeeId;
          const rosterByPending = pendingEmpId ? rosterByEmail.get(pendingEmpId) : null;
          const roster = rosterById || rosterByPending;

          // Parse name: prefer roster, fall back to displayName
          let firstName = roster?.firstName || null;
          let lastName = roster?.lastName || null;
          let middleName = roster?.middleName || null;
          if (!firstName && u.displayName) {
            const parts = u.displayName.trim().split(' ');
            firstName = parts[0] || null;
            lastName = parts.slice(1).join(' ') || null;
          }

          return {
            id: u.id,
            email: u.email,
            displayName: u.displayName,
            employeeId: roster?.employeeId || null,
            firstName,
            middleName,
            lastName,
          };
        });

      res.json(eligible);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all system users (System Admin / Manager only)
  app.get('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const callerRole = req.dbUser?.role;
      if (callerRole !== 'System Admin' && callerRole !== 'Manager') {
        return res.status(403).json({ error: 'Fulfillment Denied: Unprivileged access' });
      }

      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update a system user's role (System Admin only)
  app.put('/api/users/:id/role', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role !== 'System Admin') {
        return res.status(403).json({ error: 'Access Denied: Administrative permissions required' });
      }

      const { role } = req.body;
      const targetId = parseInt(req.params.id, 10);

      if (!['System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor', 'Member'].includes(role)) {
        return res.status(400).json({ error: 'Validation Error: Invalid application role' });
      }

      const updated = await db.update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, targetId))
        .returning();

      await db.insert(auditLogs).values({
        userId: req.dbUser.id,
        action: 'UPDATE_USER_ROLE',
        details: `Updated User ID ${targetId} role to ${role}`,
      });

      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Approve a pending user and link them to an employee roster record (System Admin only).
  // New-style users (registered with Employee ID) auto-resolve the employeeId from the
  // stored pendingEmployeeId — no body required. Legacy users still accept employeeId in body.
  app.post('/api/users/:id/approve-and-link', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role !== 'System Admin') {
        return res.status(403).json({ error: 'Access Denied: Administrative permissions required' });
      }

      const targetId = parseInt(req.params.id, 10);
      const { role } = req.body;

      // Resolve the target user to get pendingEmployeeId if set
      const targetUser = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!targetUser.length) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Use pendingEmployeeId stored at registration, or fall back to body (legacy)
      const employeeId = (targetUser[0].pendingEmployeeId || req.body.employeeId || '').trim();

      if (!employeeId) {
        return res.status(400).json({ error: 'employeeId is required to link the user.' });
      }

      // Fetch the roster entry
      const rosterEntry = await db.select().from(validEmployeeIds)
        .where(and(eq(validEmployeeIds.employeeId, employeeId), eq(validEmployeeIds.isClaimed, false)))
        .limit(1);

      if (rosterEntry.length === 0) {
        return res.status(404).json({ error: 'Employee ID not found or already claimed.' });
      }

      const emp = rosterEntry[0];

      // Approve and link the user (keep pendingEmployeeId as a permanent roster reference)
      const assignedRole = role || 'Member';
      const updated = await db.update(users)
        .set({ isActive: true, employeeIdVerified: true, role: assignedRole, updatedAt: new Date() })
        .where(eq(users.id, targetId))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Mark roster entry as claimed and record which user claimed it
      await db.update(validEmployeeIds)
        .set({ isClaimed: true, claimedByUserId: updated[0].id })
        .where(eq(validEmployeeIds.id, emp.id));

      // Auto-link or create member profile
      const fullName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
      const existingMember = await db.select().from(members)
        .where(eq(members.employeeId, emp.employeeId))
        .limit(1);

      if (existingMember.length > 0 && !existingMember[0].userId) {
        await db.update(members)
          .set({ userId: updated[0].id, updatedAt: new Date() })
          .where(eq(members.id, existingMember[0].id));
      }

      await db.insert(auditLogs).values({
        userId: req.dbUser.id,
        action: 'APPROVE_AND_LINK_USER',
        details: `Approved User ID ${targetId} and linked to Employee ID ${employeeId}`,
      });

      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get unclaimed roster entries for the approve-and-link dropdown (System Admin only)
  app.get('/api/settings/unclaimed-employees', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role !== 'System Admin') {
        return res.status(403).json({ error: 'Access Denied' });
      }
      const unclaimed = await db.select().from(validEmployeeIds)
        .where(eq(validEmployeeIds.isClaimed, false))
        .orderBy(asc(validEmployeeIds.employeeId));
      res.json(unclaimed);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Deactivate or activate a system user (System Admin only)
  app.put('/api/users/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role !== 'System Admin') {
        return res.status(403).json({ error: 'Access Denied: Administrative permissions required' });
      }

      const { isActive } = req.body;
      const targetId = parseInt(req.params.id, 10);

      const updated = await db.update(users)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(users.id, targetId))
        .returning();

      await db.insert(auditLogs).values({
        userId: req.dbUser.id,
        action: 'UPDATE_USER_STATUS',
        details: `Updated User ID ${targetId} status to ${isActive ? 'Active' : 'Inactive'}`,
      });

      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- SETTINGS ROUTES ---

  // Get app settings (public - no auth required)
  app.get('/api/settings', async (req, res) => {
    try {
      const rows = await db.select().from(appSettings);
      const settings: Record<string, string> = Object.fromEntries(rows.map(r => [r.key, r.value]));
      const countResult = await db.select({ value: sql<number>`count(*)::int` }).from(validEmployeeIds);
      settings.requireEmployeeId = countResult[0].value > 0 ? 'true' : 'false';
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Validate employee ID (public - no auth required)
  app.get('/api/settings/validate-employee-id', async (req, res) => {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ valid: false });
      const found = await db.select().from(validEmployeeIds)
        .where(and(eq(validEmployeeIds.employeeId, (id as string).trim()), eq(validEmployeeIds.isClaimed, false)))
        .limit(1);
      res.json({ valid: found.length > 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update app settings (System Admin only)
  app.put('/api/settings', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role !== 'System Admin') {
        return res.status(403).json({ error: 'Access Denied: System Admin only.' });
      }
      const { appName, appSubtitle, currencySymbol, logoUrl, motto, mission, vision, address, contactEmail, contactPhone, establishedYear } = req.body;
      const updates = [
        { key: 'app_name',        value: appName },
        { key: 'app_subtitle',    value: appSubtitle },
        { key: 'currency_symbol', value: currencySymbol },
        { key: 'logo_url',        value: logoUrl },
        { key: 'motto',           value: motto },
        { key: 'mission',         value: mission },
        { key: 'vision',          value: vision },
        { key: 'address',         value: address },
        { key: 'contact_email',   value: contactEmail },
        { key: 'contact_phone',   value: contactPhone },
        { key: 'established_year', value: establishedYear },
      ].filter(u => u.value !== undefined && u.value !== null);

      for (const u of updates) {
        await db.insert(appSettings)
          .values({ key: u.key, value: u.value ?? '', updatedAt: new Date() })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: u.value ?? '', updatedAt: new Date() } });
      }

      await db.insert(auditLogs).values({
        userId: req.dbUser.id,
        action: 'UPDATE_APP_SETTINGS',
        details: `Updated app settings`,
      });

      const rows = await db.select().from(appSettings);
      res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Upload employee roster from CSV (System Admin only)
  app.post('/api/settings/employee-ids', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role !== 'System Admin') {
        return res.status(403).json({ error: 'Access Denied: System Admin only.' });
      }
      const { employees } = req.body;
      if (!Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({ error: 'No employee records provided.' });
      }
      const values = employees
        .map((e: any) => ({
          employeeId: String(e.employeeId || '').trim(),
          firstName: String(e.firstName || '').trim() || null,
          middleName: String(e.middleName || '').trim() || null,
          lastName: String(e.lastName || '').trim() || null,
        }))
        .filter((v) => v.employeeId);

      await db.insert(validEmployeeIds).values(values).onConflictDoNothing();

      await db.insert(auditLogs).values({
        userId: req.dbUser.id,
        action: 'UPLOAD_EMPLOYEE_ROSTER',
        details: `Uploaded employee roster with ${values.length} records`,
      });

      res.json({ inserted: values.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all valid employee IDs (System Admin only)
  app.get('/api/settings/employee-ids', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role !== 'System Admin') {
        return res.status(403).json({ error: 'Access Denied: System Admin only.' });
      }
      const ids = await db.select().from(validEmployeeIds).orderBy(asc(validEmployeeIds.employeeId));
      res.json(ids);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete all valid employee IDs (System Admin only)
  app.delete('/api/settings/employee-ids', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role !== 'System Admin') {
        return res.status(403).json({ error: 'Access Denied: System Admin only.' });
      }
      await db.delete(validEmployeeIds);
      await db.insert(auditLogs).values({
        userId: req.dbUser!.id,
        action: 'CLEAR_EMPLOYEE_IDS',
        details: 'Cleared all valid employee IDs',
      });
      res.json({ cleared: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- MEMBER MODULE ROUTES ---

  // Get list of members (All staff roles may access, Members see only their matched record)
  app.get('/api/members', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      
      if (caller.role === 'Member') {
        // Find member matching linked userId
        const memberList = await db.select().from(members).where(eq(members.userId, caller.id)).limit(1);
        return res.json(memberList);
      }

      const memberList = await db.select().from(members).orderBy(asc(members.lastName));
      res.json(memberList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get member by ID with calculated ledger balances
  app.get('/api/members/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      const memberIdStr = req.params.id;
      
      let memberIdVal = parseInt(memberIdStr, 10);

      // Handle custom 'self' keyword for Member portal
      if (memberIdStr === 'self') {
        const found = await db.select().from(members).where(eq(members.userId, caller.id)).limit(1);
        if (found.length === 0) {
          return res.status(404).json({ error: "Your profile is not yet linked to a cooperative member record." });
        }
        memberIdVal = found[0].id;
      } else {
        if (caller.role === 'Member') {
          // Verify Member is only looking at their own profile
          const found = await db.select().from(members).where(eq(members.userId, caller.id)).limit(1);
          if (found.length === 0 || found[0].id !== memberIdVal) {
            return res.status(403).json({ error: "Access Denied: You cannot view other members' accounts." });
          }
        }
      }

      const memberResult = await db.select().from(members).where(eq(members.id, memberIdVal)).limit(1);
      if (memberResult.length === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const balances = await calculateMemberBalances(memberIdVal);

      res.json({
        ...memberResult[0],
        balances,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create cooperative member record (Manager, Accounting Officer, Cashier)
  app.post('/api/members', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      if (!['System Admin', 'Manager', 'Accounting Officer', 'Cashier'].includes(caller.role)) {
        return res.status(403).json({ error: 'Fulfillment Denied: Unprivileged action' });
      }

      const { employeeId, firstName, lastName, email, phone, department, linkUserEmail } = req.body;

      if (!employeeId || !firstName || !lastName || !email) {
        return res.status(400).json({ error: 'Validation Error: Required fields are missing.' });
      }

      // Check if email or employeeId is duplicated
      const dupCheck = await db.select().from(members).where(
        or(eq(members.email, email), eq(members.employeeId, employeeId))
      );
      if (dupCheck.length > 0) {
        return res.status(400).json({ error: 'Validation Error: Email or Employee ID already registered.' });
      }

      let linkedUserId: number | null = null;
      if (linkUserEmail) {
        const matchingUser = await db.select().from(users).where(eq(users.email, linkUserEmail)).limit(1);
        if (matchingUser.length > 0) {
          linkedUserId = matchingUser[0].id;
        }
      }

      const [newMember] = await db.insert(members)
        .values({
          employeeId,
          firstName,
          lastName,
          email,
          phone,
          department,
          userId: linkedUserId,
          isActive: true,
        })
        .returning();

      await db.insert(auditLogs).values({
        userId: caller.id,
        action: 'CREATE_MEMBER',
        details: `Created member ${newMember.firstName} ${newMember.lastName} [Employee ID: ${newMember.employeeId}]`,
      });

      res.status(210).json(newMember);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Edit member details
  app.put('/api/members/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      if (!['System Admin', 'Manager', 'Accounting Officer', 'Cashier'].includes(caller.role)) {
        return res.status(403).json({ error: 'Fulfillment Denied: Unprivileged action' });
      }

      const targetId = parseInt(req.params.id, 10);
      const { employeeId, firstName, lastName, email, phone, department, linkUserEmail } = req.body;

      if (!employeeId || !firstName || !lastName || !email) {
        return res.status(400).json({ error: 'Required fields missing.' });
      }

      let linkedUserId: number | null = null;
      if (linkUserEmail) {
        const matchingUser = await db.select().from(users).where(eq(users.email, linkUserEmail)).limit(1);
        if (matchingUser.length > 0) {
          linkedUserId = matchingUser[0].id;
        }
      }

      const [updated] = await db.update(members)
        .set({
          employeeId,
          firstName,
          lastName,
          email,
          phone,
          department,
          userId: linkedUserId,
          updatedAt: new Date(),
        })
        .where(eq(members.id, targetId))
        .returning();

      await db.insert(auditLogs).values({
        userId: caller.id,
        action: 'UPDATE_MEMBER',
        details: `Updated member details for Employee ID ${updated.employeeId}`,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Deactivate / Activate member
  app.put('/api/members/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      if (!['System Admin', 'Manager', 'Accounting Officer'].includes(caller.role)) {
        return res.status(403).json({ error: 'Access Denied: Insufficient authorization' });
      }

      const targetId = parseInt(req.params.id, 10);
      const { isActive } = req.body;

      const [updated] = await db.update(members)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(members.id, targetId))
        .returning();

      await db.insert(auditLogs).values({
        userId: caller.id,
        action: isActive ? 'ACTIVATE_MEMBER' : 'DEACTIVATE_MEMBER',
        details: `${isActive ? 'Activated' : 'Deactivated'} Member ID ${targetId} (${updated.firstName} ${updated.lastName})`,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- TRANSACTIONS MODULE ROUTES ---

  // Post new transaction (Deposit / Withdrawal / Share Capital / Manual Adjustment)
  app.post('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      const { memberId, transactionType, amount, description, manualDebitCoa, manualCreditCoa } = req.body;

      // Role check: Only system managers, cashiers, or accountants can initiate transactions
      if (transactionType === 'manual_adjustment') {
        if (!['System Admin', 'Accounting Officer', 'Manager'].includes(caller.role)) {
          return res.status(403).json({ error: 'Manual adjustments are strictly restricted to Accountant or Manager roles.' });
        }
      } else {
        if (!['System Admin', 'Manager', 'Accounting Officer', 'Cashier'].includes(caller.role)) {
          return res.status(403).json({ error: 'Unprivileged access: Cashier or Manager credentials required to post transactions.' });
        }
      }

      if (!memberId || !transactionType || amount === undefined) {
        return res.status(400).json({ error: 'Validation Error: Required parameters memberId, transactionType, amount is missing.' });
      }

      const amountInCents = Math.round(amount * 100);

      const txn = await createAndPostTransaction(
        parseInt(memberId, 10),
        transactionType,
        amountInCents,
        description,
        caller.id,
        manualDebitCoa,
        manualCreditCoa
      );

      await db.insert(auditLogs).values({
        userId: caller.id,
        action: 'POST_TRANSACTION',
        details: `Posted ${transactionType} of $${amount.toFixed(2)} for Member ID ${memberId} (Ref: ${txn.referenceNumber})`,
      });

      res.status(201).json(txn);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reverse transaction (restricted to Accounting Officer or Manager)
  app.post('/api/transactions/:id/reverse', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      if (!['System Admin', 'Manager', 'Accounting Officer'].includes(caller.role)) {
        return res.status(403).json({ error: 'Access Denied: Reversals are restricted to Accountant or Manager roles.' });
      }

      const transactionId = parseInt(req.params.id, 10);
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Validation Error: Reversal reason is required.' });
      }

      const reversalTxn = await reverseTransaction(transactionId, caller.id, reason);

      await db.insert(auditLogs).values({
        userId: caller.id,
        action: 'REVERSE_TRANSACTION',
        details: `Reversed transaction ID ${transactionId}. New reversal transaction Ref: ${reversalTxn.referenceNumber}`,
      });

      res.json(reversalTxn);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Get transaction logs (All Transactions)
  app.get('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      let history;

      if (caller.role === 'Member') {
        const found = await db.select().from(members).where(eq(members.userId, caller.id)).limit(1);
        if (found.length === 0) {
          return res.json([]); // Not linked
        }
        history = await db.select().from(transactions)
          .where(eq(transactions.memberId, found[0].id))
          .orderBy(desc(transactions.createdAt));
      } else {
        history = await db.select({
          id: transactions.id,
          memberId: transactions.memberId,
          transactionType: transactions.transactionType,
          amount: transactions.amount,
          status: transactions.status,
          referenceNumber: transactions.referenceNumber,
          description: transactions.description,
          createdBy: transactions.createdBy,
          createdAt: transactions.createdAt,
          memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
          employeeId: members.employeeId,
          creatorName: users.displayName
        })
        .from(transactions)
        .innerJoin(members, eq(transactions.memberId, members.id))
        .innerJoin(users, eq(transactions.createdBy, users.id))
        .orderBy(desc(transactions.createdAt));
      }

      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get transactions specific to a member of the coop
  app.get('/api/transactions/member/:memberId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      const targetIdVal = parseInt(req.params.memberId, 10);

      if (caller.role === 'Member') {
        const found = await db.select().from(members).where(eq(members.userId, caller.id)).limit(1);
        if (found.length === 0 || found[0].id !== targetIdVal) {
          return res.status(403).json({ error: 'Access Denied: You cannot view other member transactions.' });
        }
      }

      const history = await db.select().from(transactions)
        .where(eq(transactions.memberId, targetIdVal))
        .orderBy(desc(transactions.createdAt));

      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- REPORTING MODULE ENDPOINTS ---

  // Detailed account statement ledger journal lines for a specific member
  app.get('/api/reports/member-ledger/:memberId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      const memberIdVal = parseInt(req.params.memberId, 10);

      if (caller.role === 'Member') {
        const found = await db.select().from(members).where(eq(members.userId, caller.id)).limit(1);
        if (found.length === 0 || found[0].id !== memberIdVal) {
          return res.status(403).json({ error: 'Access Denied: You cannot view another member statement.' });
        }
      }

      const ledgerEntriesList = await db.select({
        id: journalEntryLines.id,
        entryType: journalEntryLines.entryType,
        amount: journalEntryLines.amount,
        coaCode: journalEntryLines.coaCode,
        coaName: chartOfAccounts.name,
        date: journalEntries.entryDate,
        description: journalEntries.description,
        transactionRef: transactions.referenceNumber,
        status: transactions.status
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.coaCode, chartOfAccounts.code))
      .leftJoin(transactions, eq(journalEntries.transactionId, transactions.id))
      .where(eq(journalEntryLines.memberId, memberIdVal))
      .orderBy(asc(journalEntries.entryDate));

      res.json(ledgerEntriesList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trial Balance (balances debits and credits)
  app.get('/api/reports/trial-balance', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'Member') {
        return res.status(403).json({ error: 'Access Denied: Auditor or Accountant permissions required.' });
      }

      const coas = await db.select().from(chartOfAccounts);

      const linesSummary = await db.select({
        coaCode: journalEntryLines.coaCode,
        type: journalEntryLines.entryType,
        sum: sql<string>`coalesce(sum(${journalEntryLines.amount}), 0)`
      })
      .from(journalEntryLines)
      .groupBy(journalEntryLines.coaCode, journalEntryLines.entryType);

      const balancesMap = coas.map(coa => {
        let debitSum = 0;
        let creditSum = 0;
        for (const row of linesSummary) {
          if (row.coaCode === coa.code) {
            if (row.type === 'debit') debitSum = parseInt(row.sum, 10);
            if (row.type === 'credit') creditSum = parseInt(row.sum, 10);
          }
        }

        // Compute netting based on standard account type
        let debitBalance = 0;
        let creditBalance = 0;

        if (coa.normalBalance === 'debit') {
          const net = debitSum - creditSum;
          if (net >= 0) {
            debitBalance = net;
          } else {
            creditBalance = -net; // negative debit balance is a credit balance
          }
        } else {
          const net = creditSum - debitSum;
          if (net >= 0) {
            creditBalance = net;
          } else {
            debitBalance = -net; // negative credit balance is a debit balance
          }
        }

        return {
          code: coa.code,
          name: coa.name,
          type: coa.type,
          normalBalance: coa.normalBalance,
          debitSum, // gross debits
          creditSum, // gross credits
          debit: debitBalance, // net active Trial Balance Debit
          credit: creditBalance // net active Trial Balance Credit
        };
      });

      res.json(balancesMap);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Financial Summaries of all member savings & capital (For Dashboard or Managers)
  app.get('/api/reports/members-summaries', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'Member') {
        return res.status(403).json({ error: 'Access Denied: Staff clearance required' });
      }

      const membersList = await db.select().from(members);

      // Fetch all member balances from current subsidiary ledger lines
      const summaryResult = await db.select({
        memberId: journalEntryLines.memberId,
        coaCode: journalEntryLines.coaCode,
        type: journalEntryLines.entryType,
        sum: sql<string>`coalesce(sum(${journalEntryLines.amount}), 0)`
      })
      .from(journalEntryLines)
      .where(sql`${journalEntryLines.memberId} is not null`)
      .groupBy(journalEntryLines.memberId, journalEntryLines.coaCode, journalEntryLines.entryType);

      const mappedSummaries = membersList.map(member => {
        let savingsCredits = 0;
        let savingsDebits = 0;
        let capitalCredits = 0;
        let capitalDebits = 0;

        for (const row of summaryResult) {
          if (row.memberId === member.id) {
            if (row.coaCode === '2010') {
              if (row.type === 'credit') savingsCredits = parseInt(row.sum, 10);
              if (row.type === 'debit') savingsDebits = parseInt(row.sum, 10);
            }
            if (row.coaCode === '3010') {
              if (row.type === 'credit') capitalCredits = parseInt(row.sum, 10);
              if (row.type === 'debit') capitalDebits = parseInt(row.sum, 10);
            }
          }
        }

        return {
          id: member.id,
          employeeId: member.employeeId,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          department: member.department,
          isActive: member.isActive,
          savings: savingsCredits - savingsDebits,
          shareCapital: capitalCredits - capitalDebits
        };
      });

      res.json(mappedSummaries);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fetch audit logs (Auditors, Managers, Administrators)
  app.get('/api/reports/audit-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      if (!['System Admin', 'Manager', 'Auditor'].includes(caller.role)) {
        return res.status(403).json({ error: 'Access Denied: Unprivileged access' });
      }

      const logs = await db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        userEmail: users.email,
        userName: users.displayName
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt));

      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fetch Chart of Accounts
  app.get('/api/coa', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await db.select().from(chartOfAccounts).orderBy(asc(chartOfAccounts.code));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Extend COA: add, update, delete
  app.post('/api/coa', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      if (!['System Admin', 'Accounting Officer'].includes(caller.role)) return res.status(403).json({ error: 'Access Denied.' });
      const { code, name, type, normalBalance, description } = req.body;
      if (!code || !name || !type || !normalBalance) return res.status(400).json({ error: 'code, name, type, and normalBalance are required.' });
      const [row] = await db.insert(chartOfAccounts).values({ code: code.trim(), name, type, normalBalance, description }).returning();
      await db.insert(auditLogs).values({ userId: caller.id, action: 'CREATE_COA', details: `Added COA ${code} - ${name}` });
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/coa/:code', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      if (!['System Admin', 'Accounting Officer'].includes(caller.role)) return res.status(403).json({ error: 'Access Denied.' });
      const { name, type, normalBalance, description } = req.body;
      const [row] = await db.update(chartOfAccounts).set({ name, type, normalBalance, description }).where(eq(chartOfAccounts.code, req.params.code)).returning();
      if (!row) return res.status(404).json({ error: 'COA not found.' });
      await db.insert(auditLogs).values({ userId: caller.id, action: 'UPDATE_COA', details: `Updated COA ${req.params.code}` });
      res.json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/coa/:code', requireAuth, async (req: AuthRequest, res) => {
    try {
      const caller = req.dbUser!;
      if (caller.role !== 'System Admin') return res.status(403).json({ error: 'Access Denied: System Admin only.' });
      const inUse = await db.select().from(journalEntryLines).where(eq(journalEntryLines.coaCode, req.params.code)).limit(1);
      if (inUse.length > 0) return res.status(400).json({ error: 'Cannot delete: this account has journal entry lines referencing it.' });
      await db.delete(chartOfAccounts).where(eq(chartOfAccounts.code, req.params.code));
      await db.insert(auditLogs).values({ userId: caller.id, action: 'DELETE_COA', details: `Deleted COA ${req.params.code}` });
      res.json({ deleted: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // --- COOPERATIVE TERMS ROUTES ---

  const adminOnly = (req: AuthRequest, res: any) => {
    if (req.dbUser?.role !== 'System Admin') { res.status(403).json({ error: 'Access Denied: System Admin only.' }); return false; }
    return true;
  };

  // Membership Types
  app.get('/api/terms/membership-types', requireAuth, async (req: AuthRequest, res) => {
    try { res.json(await db.select().from(membershipTypes).orderBy(asc(membershipTypes.sortOrder), asc(membershipTypes.name))); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/terms/membership-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, description, isActive, sortOrder } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required.' });
      const [row] = await db.insert(membershipTypes).values({ name: name.trim(), description, isActive: isActive ?? true, sortOrder: sortOrder ?? 0 }).returning();
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/terms/membership-types/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, description, isActive, sortOrder } = req.body;
      const [row] = await db.update(membershipTypes).set({ name, description, isActive, sortOrder }).where(eq(membershipTypes.id, parseInt(req.params.id))).returning();
      if (!row) return res.status(404).json({ error: 'Not found.' });
      res.json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/terms/membership-types/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      await db.delete(membershipTypes).where(eq(membershipTypes.id, parseInt(req.params.id)));
      res.json({ deleted: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Membership Statuses
  app.get('/api/terms/membership-statuses', requireAuth, async (req: AuthRequest, res) => {
    try { res.json(await db.select().from(membershipStatuses).orderBy(asc(membershipStatuses.sortOrder), asc(membershipStatuses.name))); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/terms/membership-statuses', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, description, isActive, sortOrder } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required.' });
      const [row] = await db.insert(membershipStatuses).values({ name: name.trim(), description, isActive: isActive ?? true, sortOrder: sortOrder ?? 0 }).returning();
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/terms/membership-statuses/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, description, isActive, sortOrder } = req.body;
      const [row] = await db.update(membershipStatuses).set({ name, description, isActive, sortOrder }).where(eq(membershipStatuses.id, parseInt(req.params.id))).returning();
      if (!row) return res.status(404).json({ error: 'Not found.' });
      res.json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/terms/membership-statuses/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      await db.delete(membershipStatuses).where(eq(membershipStatuses.id, parseInt(req.params.id)));
      res.json({ deleted: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Savings Products
  app.get('/api/terms/savings-products', requireAuth, async (req: AuthRequest, res) => {
    try { res.json(await db.select().from(savingsProducts).orderBy(asc(savingsProducts.name))); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/terms/savings-products', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, description, interestRateBps, minBalanceCents, isActive } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required.' });
      const [row] = await db.insert(savingsProducts).values({ name: name.trim(), description, interestRateBps: interestRateBps ?? 0, minBalanceCents: minBalanceCents ?? 0, isActive: isActive ?? true }).returning();
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/terms/savings-products/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, description, interestRateBps, minBalanceCents, isActive } = req.body;
      const [row] = await db.update(savingsProducts).set({ name, description, interestRateBps, minBalanceCents, isActive, updatedAt: new Date() }).where(eq(savingsProducts.id, parseInt(req.params.id))).returning();
      if (!row) return res.status(404).json({ error: 'Not found.' });
      res.json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/terms/savings-products/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      await db.delete(savingsProducts).where(eq(savingsProducts.id, parseInt(req.params.id)));
      res.json({ deleted: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Loan Products
  app.get('/api/terms/loan-products', requireAuth, async (req: AuthRequest, res) => {
    try { res.json(await db.select().from(loanProducts).orderBy(asc(loanProducts.name))); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/terms/loan-products', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, description, interestRateBps, maxTermMonths, minAmountCents, maxAmountCents, isActive } = req.body;
      if (!name || interestRateBps === undefined || !maxTermMonths || minAmountCents === undefined || !maxAmountCents) return res.status(400).json({ error: 'name, interestRateBps, maxTermMonths, minAmountCents, maxAmountCents are required.' });
      const [row] = await db.insert(loanProducts).values({ name: name.trim(), description, interestRateBps, maxTermMonths, minAmountCents, maxAmountCents, isActive: isActive ?? true }).returning();
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/terms/loan-products/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, description, interestRateBps, maxTermMonths, minAmountCents, maxAmountCents, isActive } = req.body;
      const [row] = await db.update(loanProducts).set({ name, description, interestRateBps, maxTermMonths, minAmountCents, maxAmountCents, isActive, updatedAt: new Date() }).where(eq(loanProducts.id, parseInt(req.params.id))).returning();
      if (!row) return res.status(404).json({ error: 'Not found.' });
      res.json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/terms/loan-products/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      await db.delete(loanProducts).where(eq(loanProducts.id, parseInt(req.params.id)));
      res.json({ deleted: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Loan Approval Matrix
  app.get('/api/terms/loan-approval-matrix', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await db.select({
        id: loanApprovalMatrix.id,
        role: loanApprovalMatrix.role,
        maxAmountCents: loanApprovalMatrix.maxAmountCents,
        loanProductId: loanApprovalMatrix.loanProductId,
        loanProductName: loanProducts.name,
        createdAt: loanApprovalMatrix.createdAt,
        updatedAt: loanApprovalMatrix.updatedAt,
      }).from(loanApprovalMatrix).leftJoin(loanProducts, eq(loanApprovalMatrix.loanProductId, loanProducts.id)).orderBy(asc(loanApprovalMatrix.role));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/terms/loan-approval-matrix', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { role, maxAmountCents, loanProductId } = req.body;
      if (!role || maxAmountCents === undefined) return res.status(400).json({ error: 'role and maxAmountCents are required.' });
      const [row] = await db.insert(loanApprovalMatrix).values({ role, maxAmountCents, loanProductId: loanProductId ?? null }).returning();
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/terms/loan-approval-matrix/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { role, maxAmountCents, loanProductId } = req.body;
      const [row] = await db.update(loanApprovalMatrix).set({ role, maxAmountCents, loanProductId: loanProductId ?? null, updatedAt: new Date() }).where(eq(loanApprovalMatrix.id, parseInt(req.params.id))).returning();
      if (!row) return res.status(404).json({ error: 'Not found.' });
      res.json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/terms/loan-approval-matrix/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      await db.delete(loanApprovalMatrix).where(eq(loanApprovalMatrix.id, parseInt(req.params.id)));
      res.json({ deleted: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Departments
  app.get('/api/terms/departments', requireAuth, async (req: AuthRequest, res) => {
    try { res.json(await db.select().from(departments).orderBy(asc(departments.name))); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/terms/departments', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, code, isActive } = req.body;
      if (!name || !code) return res.status(400).json({ error: 'Name and code are required.' });
      const [row] = await db.insert(departments).values({ name: name.trim(), code: code.trim().toUpperCase(), isActive: isActive ?? true }).returning();
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/terms/departments/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const { name, code, isActive } = req.body;
      const [row] = await db.update(departments).set({ name, code: code?.trim().toUpperCase(), isActive }).where(eq(departments.id, parseInt(req.params.id))).returning();
      if (!row) return res.status(404).json({ error: 'Not found.' });
      res.json(row);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete('/api/terms/departments/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      await db.delete(departments).where(eq(departments.id, parseInt(req.params.id)));
      res.json({ deleted: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Cooperative Parameters (share capital rules + loan eligibility — stored in app_settings)
  const PARAM_KEYS = ['share_par_value_cents', 'share_min_shares', 'share_max_shares', 'share_min_monthly_contrib_cents', 'loan_min_tenure_months', 'loan_savings_multiplier'];
  app.get('/api/terms/parameters', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await db.select().from(appSettings).where(sql`${appSettings.key} = ANY(${PARAM_KEYS})`);
      res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.put('/api/terms/parameters', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!adminOnly(req, res)) return;
      const updates = req.body as Record<string, string>;
      for (const key of PARAM_KEYS) {
        if (updates[key] !== undefined) {
          await db.update(appSettings).set({ value: String(updates[key]), updatedAt: new Date() }).where(eq(appSettings.key, key));
        }
      }
      await db.insert(auditLogs).values({ userId: req.dbUser!.id, action: 'UPDATE_COOP_PARAMETERS', details: 'Updated cooperative parameters' });
      const rows = await db.select().from(appSettings).where(sql`${appSettings.key} = ANY(${PARAM_KEYS})`);
      res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // --- VITE DEV MIDDLEWARE AND CLIENT SERVING FALLBACKS ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express and Vite Server running securely on http://localhost:${PORT}`);
  });
}

startServer();
