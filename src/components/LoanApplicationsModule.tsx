import React, { useState, useEffect } from 'react';
import { User, AppSettings } from '../types.ts';
import {
  Loader, XCircle, RefreshCw, CheckCircle, Clock,
  XOctagon, ChevronDown, ChevronUp, FileText,
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

export default function LoanApplicationsModule({ currentUser, token, settings }: LoanApplicationsModuleProps) {
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

  const canReview = ['System Admin', 'Manager', 'Accounting Officer'].includes(currentUser.role);

  useEffect(() => { fetchApplications(); }, [token]);

  const fetchApplications = async () => {
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
  };

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

  const filtered = applications.filter(a => statusFilter === 'all' || a.status === statusFilter);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':   return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />Pending</span>;
      case 'approved':  return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />Approved</span>;
      case 'rejected':  return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-red-500"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />Rejected</span>;
      case 'cancelled': return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-neutral-400"><span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />Cancelled</span>;
      default:          return <span className="text-[10px] text-neutral-400">{status}</span>;
    }
  };

  const fmt = (cents: number) => `${settings.currencySymbol}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div className="flex-grow p-4 md:p-8 overflow-y-auto h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-neutral-900">Loan Applications</h1>
          <p className="text-xs text-neutral-400 mt-1">Review and process member loan requests.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-white border border-neutral-200 text-neutral-700 text-xs rounded-lg px-3 py-2 h-9 focus:outline-none focus:ring-1 focus:ring-neutral-300 hover:bg-neutral-50 cursor-pointer">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
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
                  ? (loanApp.requestedAmountCents * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -loanApp.termMonths))
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
                            className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-500 cursor-pointer transition-colors">
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

      {/* Review Modal */}
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
                Notes {reviewModal.action === 'rejected' ? '(required — explain reason)' : '(optional)'}
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
    </div>
  );
}
