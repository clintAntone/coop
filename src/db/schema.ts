import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Users Table (system users)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  role: text('role').notNull(), // 'System Admin' | 'Manager' | 'Accounting Officer' | 'Cashier' | 'Auditor' | 'Member'
  isActive: boolean('is_active').default(true).notNull(),
  employeeIdVerified: boolean('employee_id_verified').default(true).notNull(),
  pendingEmployeeId: text('pending_employee_id'), // Set at registration; used to auto-link on approval
  avatarUrl: text('avatar_url'), // Base64 data URL or public URL for profile picture
  phone: text('phone'), // User's phone number (independent of member profile)
  tempPin: text('temp_pin'), // Hashed temporary PIN for manually-created accounts
  mustChangePassword: boolean('must_change_password').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Members Table (employee cooperative members)
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id), // Links if member has self-service login
  employeeId: text('employee_id').notNull().unique(), // Required employee identification
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  department: text('department'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Chart of Accounts Table
export const chartOfAccounts = pgTable('chart_of_accounts', {
  code: text('code').primaryKey(), // e.g. '1010' for Cash, '2010' for Savings Liability, '3010' for Share Capital Equity
  name: text('name').notNull(),
  type: text('type').notNull(), // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normalBalance: text('normal_balance').notNull(), // 'debit' | 'credit'
  description: text('description'),
});

// 4. Transactions Table (Initiation actions: deposit, withdrawal, contribution, etc.)
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').references(() => members.id).notNull(),
  transactionType: text('transaction_type').notNull(), // 'deposit' | 'withdrawal' | 'share_capital_contribution' | 'reversal' | 'manual_adjustment'
  amount: integer('amount').notNull(), // represented in CENTS to prevent float issues (positive)
  status: text('status').default('completed').notNull(), // 'completed' | 'reversed'
  referenceNumber: text('reference_number').notNull().unique(), // e.g. TXN-YYYYMMDD-XXXXXX
  description: text('description'),
  createdBy: integer('created_by').references(() => users.id).notNull(), // User/Teller ID who created it
  reversingTransactionId: integer('reversing_transaction_id'), // Self-reference inside code if this is a reversal or got reversed
  receiptData: text('receipt_data'), // base64 data URL of deposit slip / receipt (nullable for cash payments)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Journal Entries Table (Double-entry journal headings)
export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id), // Null for adjusting journal entries not tied to standard transactions
  description: text('description').notNull(),
  entryDate: timestamp('entry_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Journal Entry Lines Table (Debits & Credits detailing ledger impact per member)
export const journalEntryLines = pgTable('journal_entry_lines', {
  id: serial('id').primaryKey(),
  journalEntryId: integer('journal_entry_id').references(() => journalEntries.id, { onDelete: 'cascade' }).notNull(),
  coaCode: text('coa_code').references(() => chartOfAccounts.code).notNull(),
  memberId: integer('member_id').references(() => members.id), // If this is part of member's subsidiary ledger (not null for savings/capital lines)
  entryType: text('entry_type').notNull(), // 'debit' | 'credit'
  amount: integer('amount').notNull(), // represented in CENTS (positive)
});

// 7. Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. App Settings Table
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 9. Valid Employee IDs Table (uploaded via CSV by System Admin)
export const validEmployeeIds = pgTable('valid_employee_ids', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull().unique(),
  firstName: text('first_name'),
  middleName: text('middle_name'),
  lastName: text('last_name'),
  isClaimed: boolean('is_claimed').default(false).notNull(),
  claimedByUserId: integer('claimed_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Membership Types
export const membershipTypes = pgTable('membership_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Membership Statuses
export const membershipStatuses = pgTable('membership_statuses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Savings Products
export const savingsProducts = pgTable('savings_products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  interestRateBps: integer('interest_rate_bps').default(0).notNull(), // basis points: 250 = 2.50% p.a.
  minBalanceCents: integer('min_balance_cents').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 13. Loan Products
export const loanProducts = pgTable('loan_products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  interestRateBps: integer('interest_rate_bps').notNull(), // basis points per month: 100 = 1.00%/mo
  maxTermMonths: integer('max_term_months').notNull(),
  minAmountCents: integer('min_amount_cents').notNull(),
  maxAmountCents: integer('max_amount_cents').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 14. Loan Approval Matrix
export const loanApprovalMatrix = pgTable('loan_approval_matrix', {
  id: serial('id').primaryKey(),
  role: text('role').notNull(),
  maxAmountCents: integer('max_amount_cents').notNull(),
  loanProductId: integer('loan_product_id').references(() => loanProducts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 15. Departments
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. Loan Applications
export const loanApplications = pgTable('loan_applications', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').references(() => members.id).notNull(),
  loanProductId: integer('loan_product_id').references(() => loanProducts.id).notNull(),
  requestedAmountCents: integer('requested_amount_cents').notNull(),
  termMonths: integer('term_months').notNull(),
  purpose: text('purpose').notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewNotes: text('review_notes'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 17. Deposit Requests
export const depositRequests = pgTable('deposit_requests', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').references(() => members.id).notNull(),
  amountCents: integer('amount_cents').notNull(),
  receiptData: text('receipt_data').notNull(), // base64 data URL
  status: text('status').default('pending').notNull(), // 'pending' | 'approved' | 'rejected'
  notes: text('notes'), // admin review note
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const depositRequestsRelations = relations(depositRequests, ({ one }) => ({
  member: one(members, { fields: [depositRequests.memberId], references: [members.id] }),
  reviewer: one(users, { fields: [depositRequests.reviewedBy], references: [users.id] }),
}));

// --- Relations Definitions ---

export const usersRelations = relations(users, ({ one, many }) => ({
  member: one(members, {
    fields: [users.id],
    references: [members.userId],
  }),
  transactions: many(transactions),
  auditLogs: many(auditLogs),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  journalLines: many(journalEntryLines),
}));

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ many }) => ({
  lines: many(journalEntryLines),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  member: one(members, {
    fields: [transactions.memberId],
    references: [members.id],
  }),
  creator: one(users, {
    fields: [transactions.createdBy],
    references: [users.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [transactions.id],
    references: [journalEntries.transactionId],
  }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  transaction: one(transactions, {
    fields: [journalEntries.transactionId],
    references: [transactions.id],
  }),
  lines: many(journalEntryLines),
}));

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  heading: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  coa: one(chartOfAccounts, {
    fields: [journalEntryLines.coaCode],
    references: [chartOfAccounts.code],
  }),
  member: one(members, {
    fields: [journalEntryLines.memberId],
    references: [members.id],
  }),
}));

export const loanApplicationsRelations = relations(loanApplications, ({ one }) => ({
  member: one(members, { fields: [loanApplications.memberId], references: [members.id] }),
  product: one(loanProducts, { fields: [loanApplications.loanProductId], references: [loanProducts.id] }),
  reviewer: one(users, { fields: [loanApplications.reviewedBy], references: [users.id] }),
}));
