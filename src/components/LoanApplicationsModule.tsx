import React, { useState, useEffect, useCallback } from 'react';
import { User, AppSettings } from '../types.ts';
import InfoButton from './InfoButton.tsx';
import {
  Loader, XCircle, RefreshCw, CheckCircle, Clock,
  XOctagon, ChevronDown, ChevronUp, FileText,
  DollarSign, ArrowDownCircle, HandCoins,
} from 'lucide-react';

interface LoanApplicationsModuleProps {
  currentUser: User;
  token: string;
  settings: AppSettings;
}

interface LoanApplication {
  id: number;
  requestedAmountCents: number;
  termMonths: number;
  purpose: string;
  status: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  loanProductName: string | null;
  loanProductInterestBps: number | null;
  memberFirstName: string | null;
  memberLastName: string | null;
  memberEmployeeId: string | null;
  memberDepartment: string | null;
}

interface ActiveLoan {
  id: number;
  memberId: number;
  memberFirstName: string | null;
  memberLastName: string | null;
  memberEmployeeId: string | null;
  memberDepartment: string | null;
  loanProductName: string | null;
  loanProductInterestBps: number | null;
  requestedAmountCents: number;
  termMonths: number;
  purpose: string;
  disbursedAt: string | null;
  outstandingCents: number;
}

interface LoanPayment {
  id: number;
  transactionType: string;
  amount: number;
  referenceNumber: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export default function LoanApplicationsModule({ currentUser, token, settings }: LoanApplicationsModuleProps) {
  // ── Applications tab state ──────────────────────────────────────────────
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Review modal state
  const [reviewModal, setReviewModal] = useState<{ app: LoanApplication; action: 'approved' | 'rejected' } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // ── Tab state ───────────────────────────────────────────────────────────
  const [activeModuleTab, setActiveModuleTab] = useState<'applications' | 'active-loans'>('applications');

  // ── Active loans tab state ──────────────────────────────────────────────
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [activeLoansLoading, setActiveLoansLoading] = useState(false);
  const [activeLoansError, setActiveLoansError] = useState<string | null>(null);

  // Disburse modal
  const [disburseModal, setDisburseModal] = useState<{ app: LoanApplication } | null>(null);
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [disburseError, setDisburseError] = useState<string | null>(null);

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<{ loan: ActiveLoan } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Payment history per loan
  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);
  const [loanPayments, setLoanPayments] = useState<Record<number, LoanPayment[]>>({});
  const [loanPaymentsLoading, setLoanPaymentsLoading] = useState<Record<number, boolean>>({});

  const canReview = ['System Admin', 'Manager', 'Accounting Officer'].includes(currentUser.role);

  // ── Fetch functions ─────────────────────────────────────────────────────
  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/loan-applications', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fetch applications.'); }
      setApplications(await res.json());
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const fetchActiveLoans = useCallback(async () => {
    setActiveLoansLoading(true);
    setActiveLoansError(null);
    try {
      const res = await fetch('/api/loan-applications/active', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fetch active loans.'); }
      setActiveLoans(await res.json());
    } catch (err: any) {
      setActiveLoansError(err.message);
    } finally {
      setActiveLoansLoading(false);
    }
  }, [token]);

  const fetchLoanPayments = useCallback(async (loanId: number) => {
    setLoanPaymentsLoading(prev => ({ ...prev, [loanId]: true }));
    try {
      const res = await fetch(`/api/loan-applications/${loanId}/payments`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fetch payments.'); }
      const data = await res.json();
      setLoanPayments(prev => ({ ...prev, [loanId]: data }));
    } catch {
      // silently fail; payments section will just be empty
    } finally {
      setLoanPaymentsLoading(prev => ({ ...prev, [loanId]: false }));
    }
  }, [token]);

  useEffect(() => {
    fetchApplications();
    fetchActiveLoans();
  }, [fetchApplications, fetchActiveLoans]);

  // When switching to active-loans tab, refresh
  const handleTabChange = (tab: 'applications' | 'active-loans') => {
    setActiveModuleTab(tab);
    if (tab === 'active-loans') fetchActiveLoans();
  };

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleReview = async () => {
    if (!reviewModal) return;
    setIsReviewing(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/loan-applications/${reviewModal.app.id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: reviewModal.action, reviewNotes }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Review failed.'); }
      setReviewModal(null);
      setReviewNotes('');
      fetchApplications();
    } catch (err: any) {
      setReviewError(err.message);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleDisburse = async () => {
    if (!disburseModal) return;
    setIsDisbursing(true);
    setDisburseError(null);
    try {
      const res = await fetch(`/api/loan-applications/${disburseModal.app.id}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Disbursement failed.'); }
      setDisburseModal(null);
      fetchApplications();
      fetchActiveLoans();
      setActiveModuleTab('active-loans');
    } catch (err: any) {
      setDisburseError(err.message);
    } finally {
      setIsDisbursing(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentModal) return;
    const amountCents = Math.round(parseFloat(paymentAmount) * 100);
    if (!paymentAmount || isNaN(amountCents) || amountCents <= 0) {
      setPaymentError('Please enter a valid amount greater than zero.');
      return;
    }
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      const res = await fetch(`/api/loan-applications/${paymentModal.loan.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountCents, notes: paymentNotes || undefined }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Payment failed.'); }
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentNotes('');
      // Refresh payment history for expanded loan
      if (expandedLoanId === paymentModal.loan.id) {
        fetchLoanPayments(paymentModal.loan.id);
      }
      fetchActiveLoans();
    } catch (err: any) {
      setPaymentError(err.message);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleToggleLoanExpand = (loanId: number) => {
    if (expandedLoanId === loanId) {
      setExpandedLoanId(null);
    } else {
      setExpandedLoanId(loanId);
      if (!loanPayments[loanId]) {
        fetchLoanPayments(loanId);
      }
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const filtered = applications.filter(a => statusFilter === 'all' || a.status === statusFilter);

  const fmt = (cents: number) => `${settings.currencySymbol}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':   return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />Pending</span>;
      case 'approved':  return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />Approved</span>;
      case 'rejected':  return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-red-500"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />Rejected</span>;
      case 'cancelled': return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-neutral-400"><span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />Cancelled</span>;
      case 'disbursed': return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-blue-600"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />Disbursed</span>;
      default:          return <span className="text-[10px] text-neutral-400">{status}</span>;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-grow p-4 md:p-8 overflow-y-auto h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-medium tracking-tight text-neutral-900">Loan Management</h1>
            <InfoButton text="Review and process loan requests submitted by members. Approve or reject applications, disburse approved loans, and track repayments." />
          </div>
          <p className="text-xs text-neutral-400 mt-1">Manage member loan applications and active loan accounts.</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-neutral-200">
        <button
          onClick={() => handleTabChange('applications')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer -mb-px ${
            activeModuleTab === 'applications'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-400 hover:text-neutral-600'
          }`}
        >
          Applications
        </button>
        <button
          onClick={() => handleTabChange('active-loans')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer -mb-px ${
            activeModuleTab === 'active-loans'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-400 hover:text-neutral-600'
          }`}
        >
          Active Loans
        </button>
      </div>

      {/* ── Applications Tab ─────────────────────────────────────────────── */}
      {activeModuleTab === 'applications' && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div />
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-white border border-neutral-200 text-neutral-700 text-xs rounded-lg px-3 py-2 h-9 focus:outline-none focus:ring-1 focus:ring-neutral-300 hover:bg-neutral-50 cursor-pointer">
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="disbursed">Disbursed</option>
              </select>
              <button onClick={fetchApplications} disabled={isLoading}
                className="flex items-center gap-1.5 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold py-2 px-3 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />{errorMessage}
            </div>
          )}

          {isLoading && applications.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Loader className="w-6 h-6 text-neutral-400 animate-spin" />
              <span className="text-xs text-neutral-500">Loading applications...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-16 text-center shadow-sm">
              <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <h3 className="text-xs font-semibold text-neutral-800">No {statusFilter === 'all' ? '' : statusFilter} applications</h3>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xl shadow-neutral-200/20">
              <div className="overflow-x-auto"><table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] uppercase font-bold text-neutral-400">
                    <th className="py-3 px-6">Member</th>
                    <th className="py-3 px-4">Loan Product</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4 hidden md:table-cell">Term</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 hidden md:table-cell">Applied</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {filtered.map(loanApp => {
                    const isExpanded = expandedId === loanApp.id;
                    const initials = `${loanApp.memberFirstName?.[0] ?? ''}${loanApp.memberLastName?.[0] ?? ''}`.toUpperCase();
                    const appliedDate = new Date(loanApp.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    const monthlyRate = loanApp.loanProductInterestBps ? loanApp.loanProductInterestBps / 10000 : 0;
                    const monthly = loanApp.requestedAmountCents > 0 && loanApp.termMonths > 0
                      ? monthlyRate > 0
                        ? (loanApp.requestedAmountCents * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -loanApp.termMonths))
                        : loanApp.requestedAmountCents / loanApp.termMonths
                      : 0;
                    return (
                      <React.Fragment key={loanApp.id}>
                        <tr className="hover:bg-neutral-50/40 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center font-bold text-neutral-600 text-[11px] shrink-0 uppercase">
                                {initials || '??'}
                              </div>
                              <div>
                                <div className="font-semibold text-neutral-900">{loanApp.memberFirstName} {loanApp.memberLastName}</div>
                                <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{loanApp.memberEmployeeId || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-neutral-600">{loanApp.loanProductName || '—'}</td>
                          <td className="py-4 px-4 font-semibold text-neutral-900 font-mono">{fmt(loanApp.requestedAmountCents)}</td>
                          <td className="py-4 px-4 text-neutral-600 hidden md:table-cell">{loanApp.termMonths} mo.</td>
                          <td className="py-4 px-4">{statusBadge(loanApp.status)}</td>
                          <td className="py-4 px-4 text-[10px] text-neutral-500 font-mono hidden md:table-cell">{appliedDate}</td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => setExpandedId(isExpanded ? null : loanApp.id)}
                                title={isExpanded ? 'Collapse details' : 'Expand details'}
                                className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-500 cursor-pointer transition-colors">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              {canReview && loanApp.status === 'pending' && (
                                <>
                                  <button onClick={() => { setReviewModal({ app: loanApp, action: 'approved' }); setReviewNotes(''); setReviewError(null); }}
                                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold py-1 px-2.5 rounded-md cursor-pointer transition-colors">
                                    <CheckCircle className="w-3 h-3" />Approve
                                  </button>
                                  <button onClick={() => { setReviewModal({ app: loanApp, action: 'rejected' }); setReviewNotes(''); setReviewError(null); }}
                                    className="flex items-center gap-1 border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-semibold py-1 px-2.5 rounded-md cursor-pointer transition-colors">
                                    <XOctagon className="w-3 h-3" />Reject
                                  </button>
                                </>
                              )}
                              {canReview && loanApp.status === 'approved' && (
                                <button onClick={() => { setDisburseModal({ app: loanApp }); setDisburseError(null); }}
                                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold py-1 px-2.5 rounded-md cursor-pointer transition-colors">
                                  <ArrowDownCircle className="w-3 h-3" />Disburse
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="px-6 pb-4 pt-0 bg-neutral-50/40">
                              <div className="rounded-lg border border-neutral-100 bg-white p-4 grid grid-cols-3 gap-4 text-xs">
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Purpose</div>
                                  <div className="text-neutral-700 leading-relaxed">{loanApp.purpose}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Est. Monthly Payment</div>
                                  <div className="text-neutral-900 font-mono font-semibold">{monthly > 0 ? fmt(Math.round(monthly)) : '—'}</div>
                                  <div className="text-[10px] text-neutral-400 mt-0.5">{loanApp.loanProductInterestBps ? `${loanApp.loanProductInterestBps / 100}% / mo.` : ''}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Department</div>
                                  <div className="text-neutral-700">{loanApp.memberDepartment || '—'}</div>
                                </div>
                                {loanApp.reviewNotes && (
                                  <div className="col-span-3">
                                    <div className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Review Notes</div>
                                    <div className="text-neutral-700 bg-neutral-50 border border-neutral-100 rounded p-2 leading-relaxed">{loanApp.reviewNotes}</div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}

      {/* ── Active Loans Tab ─────────────────────────────────────────────── */}
      {activeModuleTab === 'active-loans' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Active Loans</h2>
              <p className="text-xs text-neutral-400 mt-0.5">All disbursed loans with outstanding balances.</p>
            </div>
            <button onClick={fetchActiveLoans} disabled={activeLoansLoading}
              className="flex items-center gap-1.5 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold py-2 px-3 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${activeLoansLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {activeLoansError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />{activeLoansError}
            </div>
          )}

          {activeLoansLoading && activeLoans.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Loader className="w-6 h-6 text-neutral-400 animate-spin" />
              <span className="text-xs text-neutral-500">Loading active loans...</span>
            </div>
          ) : activeLoans.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-16 text-center shadow-sm">
              <HandCoins className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <h3 className="text-xs font-semibold text-neutral-800">No active loans</h3>
              <p className="text-[10px] text-neutral-400 mt-1">Disbursed loans will appear here.</p>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xl shadow-neutral-200/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] uppercase font-bold text-neutral-400">
                      <th className="py-3 px-6">Member</th>
                      <th className="py-3 px-4">Loan Product</th>
                      <th className="py-3 px-4">Disbursed</th>
                      <th className="py-3 px-4">Outstanding</th>
                      <th className="py-3 px-4 hidden md:table-cell">Term</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {activeLoans.map(loan => {
                      const initials = `${loan.memberFirstName?.[0] ?? ''}${loan.memberLastName?.[0] ?? ''}`.toUpperCase();
                      const isPaidOff = loan.outstandingCents <= 0;
                      const isLoanExpanded = expandedLoanId === loan.id;
                      const payments = loanPayments[loan.id] ?? [];
                      const paymentsLoading = loanPaymentsLoading[loan.id] ?? false;

                      return (
                        <React.Fragment key={loan.id}>
                          <tr className="hover:bg-neutral-50/40 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center font-bold text-neutral-600 text-[11px] shrink-0 uppercase">
                                  {initials || '??'}
                                </div>
                                <div>
                                  <div className="font-semibold text-neutral-900">{loan.memberFirstName} {loan.memberLastName}</div>
                                  <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{loan.memberEmployeeId || '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-neutral-600">{loan.loanProductName || '—'}</td>
                            <td className="py-4 px-4 font-semibold text-neutral-900 font-mono">{fmt(loan.requestedAmountCents)}</td>
                            <td className="py-4 px-4">
                              <span className={`font-mono font-semibold ${isPaidOff ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {fmt(Math.max(0, loan.outstandingCents))}
                              </span>
                              {isPaidOff && <span className="ml-1.5 text-[10px] text-emerald-500 font-medium">Paid off</span>}
                            </td>
                            <td className="py-4 px-4 text-neutral-600 hidden md:table-cell">{loan.termMonths} mo.</td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleToggleLoanExpand(loan.id)}
                                  title={isLoanExpanded ? 'Collapse payment history' : 'Expand payment history'}
                                  className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-500 cursor-pointer transition-colors">
                                  {isLoanExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                {canReview && (
                                  <button
                                    onClick={() => { setPaymentModal({ loan }); setPaymentAmount(''); setPaymentNotes(''); setPaymentError(null); }}
                                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold py-1 px-2.5 rounded-md cursor-pointer transition-colors">
                                    <DollarSign className="w-3 h-3" />Record Payment
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Payment history expanded row */}
                          {isLoanExpanded && (
                            <tr>
                              <td colSpan={6} className="px-6 pb-4 pt-0 bg-neutral-50/40">
                                <div className="rounded-lg border border-neutral-100 bg-white overflow-hidden">
                                  <div className="px-4 py-2.5 border-b border-neutral-100 flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-bold text-neutral-400">Payment History</span>
                                    {loan.disbursedAt && (
                                      <span className="text-[10px] text-neutral-400">
                                        Disbursed: {new Date(loan.disbursedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                  {paymentsLoading ? (
                                    <div className="py-6 flex items-center justify-center gap-2">
                                      <Loader className="w-4 h-4 text-neutral-400 animate-spin" />
                                      <span className="text-[10px] text-neutral-400">Loading...</span>
                                    </div>
                                  ) : payments.length === 0 ? (
                                    <div className="py-6 text-center text-[10px] text-neutral-400">No payment transactions recorded yet.</div>
                                  ) : (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-neutral-50 text-[10px] uppercase font-bold text-neutral-400 border-b border-neutral-100">
                                          <th className="py-2 px-4">Date</th>
                                          <th className="py-2 px-4">Type</th>
                                          <th className="py-2 px-4">Reference</th>
                                          <th className="py-2 px-4 text-right">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-neutral-50">
                                        {payments.map(p => (
                                          <tr key={p.id} className="hover:bg-neutral-50/50">
                                            <td className="py-2 px-4 text-[10px] text-neutral-500 font-mono">
                                              {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="py-2 px-4">
                                              <span className={`text-[10px] font-medium ${p.transactionType === 'loan_disbursement' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                                {p.transactionType === 'loan_disbursement' ? 'Disbursement' : 'Payment'}
                                              </span>
                                            </td>
                                            <td className="py-2 px-4 font-mono text-[10px] text-neutral-500">{p.referenceNumber}</td>
                                            <td className="py-2 px-4 font-mono font-semibold text-right text-neutral-900">{fmt(p.amount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Review Modal ─────────────────────────────────────────────────── */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                {reviewModal.action === 'approved' ? 'Approve Loan Application' : 'Reject Loan Application'}
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                {reviewModal.app.memberFirstName} {reviewModal.app.memberLastName} · {reviewModal.app.loanProductName} · {fmt(reviewModal.app.requestedAmountCents)} / {reviewModal.app.termMonths} mo.
              </p>
            </div>
            {reviewError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{reviewError}</div>
            )}
            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                Notes{reviewModal.action === 'rejected' && <span className="text-red-400 ml-0.5">*</span>}
                <span className="normal-case font-normal ml-1">{reviewModal.action === 'rejected' ? '(required — explain reason)' : '(optional)'}</span>
              </label>
              <textarea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                rows={3}
                placeholder={reviewModal.action === 'rejected' ? 'Reason for rejection...' : 'Any conditions or remarks...'}
                className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setReviewModal(null)}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors">
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={isReviewing || (reviewModal.action === 'rejected' && !reviewNotes.trim())}
                className={`flex-1 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  reviewModal.action === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'
                }`}>
                {isReviewing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : reviewModal.action === 'approved' ? <CheckCircle className="w-3.5 h-3.5" /> : <XOctagon className="w-3.5 h-3.5" />}
                {isReviewing ? 'Processing...' : reviewModal.action === 'approved' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Disburse Confirmation Modal ──────────────────────────────────── */}
      {disburseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Confirm Loan Disbursement</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Disburse {fmt(disburseModal.app.requestedAmountCents)} to {disburseModal.app.memberFirstName} {disburseModal.app.memberLastName}?
              </p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg">
              This will post a Loan Disbursement transaction and mark the loan as active. This action cannot be undone without a manual reversal.
            </div>
            {disburseError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{disburseError}</div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDisburseModal(null)} disabled={isDisbursing}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDisburse} disabled={isDisbursing}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                {isDisbursing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}
                {isDisbursing ? 'Disbursing...' : 'Confirm Disburse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ────────────────────────────────────────────────── */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Record Loan Payment</h2>
              <p className="text-xs text-neutral-500 mt-1">
                {paymentModal.loan.memberFirstName} {paymentModal.loan.memberLastName} · Outstanding: {fmt(Math.max(0, paymentModal.loan.outstandingCents))}
              </p>
            </div>
            {paymentError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{paymentError}</div>
            )}
            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                Amount <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">{settings.currencySymbol}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-xs border border-neutral-200 bg-white rounded-lg pl-7 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Notes <span className="font-normal normal-case">(optional)</span></label>
              <input
                type="text"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                placeholder="e.g. Monthly payment, partial payment..."
                className="w-full text-xs border border-neutral-200 bg-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setPaymentModal(null)} disabled={paymentSubmitting}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handlePayment} disabled={paymentSubmitting || !paymentAmount}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                {paymentSubmitting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                {paymentSubmitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
