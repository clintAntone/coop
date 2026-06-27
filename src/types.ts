export interface User {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  role: string; // 'System Admin' | 'Manager' | 'Accounting Officer' | 'Cashier' | 'Auditor' | 'Member'
  isActive: boolean;
  employeeIdVerified: boolean;
  mustChangePassword: boolean;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  appName: string;
  appSubtitle: string;
  currencySymbol: string;
  requireEmployeeId: boolean;
  logoUrl: string;
  motto: string;
  mission: string;
  vision: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  establishedYear: string;
}

export interface MemberBalances {
  savingsInCents: number;
  shareCapitalInCents: number;
}

export interface Member {
  id: number;
  userId: number | null;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  balances?: MemberBalances;
}

export interface MemberSummary {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  isActive: boolean;
  savings: number; // in cents
  shareCapital: number; // in cents
}

export interface Transaction {
  id: number;
  memberId: number;
  transactionType: 'deposit' | 'withdrawal' | 'share_capital_contribution' | 'reversal' | 'manual_adjustment';
  amount: number; // in cents
  status: 'completed' | 'reversed';
  referenceNumber: string;
  description: string | null;
  createdBy: number;
  reversingTransactionId: number | null;
  createdAt: string;
  memberName?: string;
  employeeId?: string;
  creatorName?: string | null;
}

export interface TrialBalanceItem {
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  debitSum: number;
  creditSum: number;
  debit: number; // calculated Trial Balance Debit
  credit: number; // calculated Trial Balance Credit
}

export interface LedgerLine {
  id: number;
  entryType: 'debit' | 'credit';
  amount: number; // in cents
  coaCode: string;
  coaName: string;
  date: string;
  description: string;
  transactionRef: string | null;
  status?: string;
}

export interface AuditLog {
  id: number;
  action: string;
  details: string | null;
  createdAt: string;
  userEmail: string | null;
  userName: string | null;
}

export interface ChartOfAccount {
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  description: string | null;
}

export interface MembershipType {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface MembershipStatus {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface SavingsProduct {
  id: number;
  name: string;
  description: string | null;
  interestRateBps: number; // basis points: 250 = 2.50% p.a.
  minBalanceCents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoanProduct {
  id: number;
  name: string;
  description: string | null;
  interestRateBps: number; // basis points per month: 100 = 1.00%/mo
  maxTermMonths: number;
  minAmountCents: number;
  maxAmountCents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoanApprovalEntry {
  id: number;
  role: string;
  maxAmountCents: number;
  loanProductId: number | null;
  loanProductName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface CoopParameters {
  share_par_value_cents: string;
  share_min_shares: string;
  share_max_shares: string;
  share_min_monthly_contrib_cents: string;
  loan_min_tenure_months: string;
  loan_savings_multiplier: string;
}
