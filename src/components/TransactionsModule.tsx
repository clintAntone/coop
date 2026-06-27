import React, { useState, useEffect } from 'react';
import { Member, Transaction, ChartOfAccount, User, AppSettings } from '../types.ts';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  X,
  Search,
  ArrowRight,
  ShieldAlert,
  Loader,
  CheckCircle,
  XCircle,
  HelpCircle,
  Clock,
  UserCheck2,
  AlertTriangle,
  RefreshCw,
  Coins,
  Download,
  Printer
} from 'lucide-react';

interface TransactionsModuleProps {
  currentUser: User;
  token: string;
  settings: AppSettings;
}

export default function TransactionsModule({ currentUser, token, settings }: TransactionsModuleProps) {
  const [transactionsList, setTransactionsList] = useState<Transaction[]>([]);
  const [membersList, setMembersList] = useState<Member[]>([]);
  const [coaList, setCoaList] = useState<ChartOfAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Modal Posting states
  const [showPostingModal, setShowPostingModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdrawal' | 'share_capital_contribution' | 'manual_adjustment'>('deposit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [manualDebitCoa, setManualDebitCoa] = useState('2010'); // Defaults to Savings Liability
  const [manualCreditCoa, setManualCreditCoa] = useState('3010'); // Defaults to Share Capital Equity
  const [posting, setPosting] = useState(false);

  const closePostingModal = () => {
    setShowPostingModal(false);
    setSelectedMemberId('');
    setMemberSearch('');
    setTransactionType('deposit');
    setAmount('');
    setDescription('');
    setManualDebitCoa('2010');
    setManualCreditCoa('3010');
  };

  // Modal Reversal state
  const [reversalTarget, setReversalTarget] = useState<Transaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);

  // Deposit requests tab
  const [activeTab, setActiveTab] = useState<'ledger' | 'deposits'>('ledger');
  const [depositRequestsList, setDepositRequestsList] = useState<any[]>([]);
  const [depositReviewModal, setDepositReviewModal] = useState<any | null>(null);
  const [depositReviewNotes, setDepositReviewNotes] = useState('');
  const [depositReviewing, setDepositReviewing] = useState(false);
  const [depositReviewError, setDepositReviewError] = useState<string | null>(null);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
  const [depositRequestsLoading, setDepositRequestsLoading] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchMembers();
    fetchCOAs();
    fetchDepositRequests();
  }, [token]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPostingModal) closePostingModal();
        if (reversalTarget) { setReversalTarget(null); setReversalReason(''); }
        if (viewReceiptUrl) setViewReceiptUrl(null);
        if (depositReviewModal) { setDepositReviewModal(null); setDepositReviewNotes(''); setDepositReviewError(null); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showPostingModal, reversalTarget, viewReceiptUrl, depositReviewModal]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    setErrMsg(null);
    try {
      const res = await fetch('/api/transactions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve general transaction ledger logs.');
      const data = await res.json();
      setTransactionsList(data);
    } catch (err: any) {
      console.error(err);
      setErrMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Only load active members for posting new transactions
        setMembersList(data.filter((m: Member) => m.isActive));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCOAs = async () => {
    try {
      const res = await fetch('/api/coa', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCoaList(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepositRequests = async () => {
    setDepositRequestsLoading(true);
    try {
      const res = await fetch('/api/deposit-requests', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDepositRequestsList(await res.json());
    } catch {} finally { setDepositRequestsLoading(false); }
  };

  const handleDepositReview = async (action: 'approve' | 'reject') => {
    if (!depositReviewModal) return;
    if (action === 'reject' && !depositReviewNotes.trim()) { setDepositReviewError('Rejection reason is required.'); return; }
    setDepositReviewing(true);
    setDepositReviewError(null);
    try {
      const res = await fetch(`/api/deposit-requests/${depositReviewModal.id}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: depositReviewNotes }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setDepositReviewModal(null);
      setDepositReviewNotes('');
      fetchDepositRequests();
      if (action === 'approve') fetchTransactions();
    } catch (err: any) { setDepositReviewError(err.message); }
    finally { setDepositReviewing(false); }
  };

  const handleOpenPosting = () => {
    setSelectedMemberId('');
    setMemberSearch('');
    setMemberSearchOpen(false);
    setTransactionType('deposit');
    setAmount('');
    setDescription('');
    setManualDebitCoa('2010');
    setManualCreditCoa('3010');
    setErrMsg(null);
    setShowPostingModal(true);
  };

  const handlePostTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setErrMsg(null);

    const payload = {
      memberId: selectedMemberId,
      transactionType,
      amount: parseFloat(amount),
      description,
      manualDebitCoa: transactionType === 'manual_adjustment' ? manualDebitCoa : undefined,
      manualCreditCoa: transactionType === 'manual_adjustment' ? manualCreditCoa : undefined,
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fulfillment failure: unable to post transaction.');
      }

      closePostingModal();
      fetchTransactions();
    } catch (err: any) {
      console.error(err);
      setErrMsg(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleReverseTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget) return;
    setReversing(true);
    setErrMsg(null);

    try {
      const res = await fetch(`/api/transactions/${reversalTarget.id}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reversalReason })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Server error applying reversal.');
      }

      setReversalTarget(null);
      setReversalReason('');
      fetchTransactions();
    } catch (err: any) {
      console.error(err);
      setErrMsg(err.message);
    } finally {
      setReversing(false);
    }
  };

  const filteredTxns = transactionsList.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchesName = t.memberName ? t.memberName.toLowerCase().includes(term) : false;
    const matchesEmp = t.employeeId ? t.employeeId.toLowerCase().includes(term) : false;
    const matchesRef = t.referenceNumber.toLowerCase().includes(term);
    const matchesType = t.transactionType.toLowerCase().includes(term);
    return matchesName || matchesEmp || matchesRef || matchesType;
  });

  const visibleTxns = filteredTxns.slice(0, visibleCount);

  const exportCsv = () => {
    const headers = ['Date', 'Reference', 'Member Name', 'Employee ID', 'Type', 'Description', 'Amount', 'Status', 'Posted By'];
    const rows = filteredTxns.map(txn => [
      new Date(txn.createdAt).toLocaleString(),
      txn.referenceNumber,
      txn.memberName || '',
      txn.employeeId || '',
      txn.transactionType,
      (txn.description || '').replace(/,/g, ' '),
      (txn.amount / 100).toFixed(2),
      txn.status,
      txn.creatorName || 'System',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ledger-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-grow p-4 md:p-8 overflow-y-auto h-screen">
      {/* Top Controls */}
      <div className="flex items-start justify-between gap-3 mb-6 md:mb-8">
        <div className="min-w-0">
          <h1 className="text-xl font-medium tracking-tight text-neutral-900 font-sans">
            Postings & Journal Logs
          </h1>
          <p className="text-xs text-neutral-400 mt-1 hidden sm:block">
            Review detailed financial transaction logs, search references, or post new double-entry activities.
          </p>
        </div>

        {['System Admin', 'Manager', 'Accounting Officer', 'Cashier'].includes(currentUser.role) && (
          <button
            onClick={handleOpenPosting}
            className="shrink-0 flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Post New Transaction</span>
            <span className="sm:hidden">Post</span>
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      {['System Admin', 'Manager', 'Accounting Officer', 'Cashier'].includes(currentUser.role) && (
        <div className="flex gap-1 mb-6 bg-neutral-100 rounded-xl p-1 w-fit">
          <button onClick={() => setActiveTab('ledger')}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'ledger' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
            Ledger
          </button>
          <button onClick={() => { setActiveTab('deposits'); fetchDepositRequests(); }}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'deposits' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
            Deposit Requests
            {depositRequestsList.filter(d => d.status === 'pending').length > 0 && (
              <span className="bg-amber-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {depositRequestsList.filter(d => d.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Main Ledger Sheet */}
      {activeTab === 'ledger' && (
      <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xl shadow-neutral-200/20 overflow-hidden">
        {/* Filtering bar */}
        <div className="p-4 border-b border-neutral-150 bg-neutral-50/40 flex items-center gap-3">
          <div className="relative flex-grow min-w-0">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="text"
              placeholder="Search member, reference..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(50); }}
              className="w-full text-xs pl-9 pr-4 py-2 border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400 text-neutral-800 placeholder-neutral-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTransactions}
              className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            <button
              onClick={exportCsv}
              title="Export as CSV (Excel)"
              className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            <button
              onClick={() => window.print()}
              title="Print / Export as PDF"
              className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer print:hidden"
            >
              <Printer className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-neutral-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              Live
            </span>
          </div>
        </div>

        {/* List Content */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader className="w-6 h-6 text-neutral-400 animate-spin" />
            <span className="text-xs text-neutral-500 font-medium">Reconciling General Ledger...</span>
          </div>
        ) : filteredTxns.length === 0 ? (
          <div className="py-24 text-center max-w-xs mx-auto flex flex-col items-center gap-3">
            <HelpCircle className="w-10 h-10 text-neutral-300" />
            <h3 className="text-xs font-semibold text-neutral-800">No Postings Found</h3>
            <p className="text-[11px] text-neutral-400">
              {searchTerm ? 'No results matched this search filter.' : 'Transactions initiated on tellers appear immediately on this ledger list.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-neutral-100">
              {visibleTxns.map((txn) => {
                const date = new Date(txn.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const isReversed = txn.status === 'reversed';
                const canReverse = ['System Admin', 'Manager', 'Accounting Officer'].includes(currentUser.role) && !isReversed && txn.transactionType !== 'reversal';
                return (
                  <div key={txn.id} className={`px-4 py-3.5 ${isReversed ? 'bg-red-50/30' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-neutral-900 truncate">{txn.memberName || '—'}</span>
                          {isReversed && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 bg-red-50 text-red-500 border border-red-200">
                              Reversed
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{txn.employeeId}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold">
                            {txn.transactionType === 'deposit' && <span className="text-emerald-700">Savings Deposit</span>}
                            {txn.transactionType === 'withdrawal' && <span className="text-amber-700">Savings Withdrawal</span>}
                            {txn.transactionType === 'share_capital_contribution' && <span className="text-blue-700">Share Capital</span>}
                            {txn.transactionType === 'manual_adjustment' && <span className="text-neutral-500">Manual Adjustment</span>}
                            {txn.transactionType === 'reversal' && <span className="text-red-600">Reversing Entry</span>}
                          </span>
                          <span className="text-[9px] text-neutral-400 font-mono">{date}</span>
                        </div>
                        <div className="text-[9px] text-neutral-400 font-mono mt-0.5">{txn.referenceNumber}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-mono font-semibold text-neutral-900">
                          {settings.currencySymbol}{(txn.amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        {canReverse && (
                          <button onClick={() => setReversalTarget(txn)} className="text-[11px] text-red-500 font-semibold mt-1 cursor-pointer">
                            Reverse
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto text-xs">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-500 text-[10px] uppercase font-semibold border-b border-neutral-150">
                    <th className="py-3 px-4 w-32">Date & Reference</th>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Transaction Type</th>
                    <th className="py-3 px-4 w-52">Description Memo</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center w-28">Status</th>
                    {['System Admin', 'Manager', 'Accounting Officer'].includes(currentUser.role) && (
                      <th className="py-3 px-4 w-24 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150">
                  {visibleTxns.map((txn) => {
                    const date = new Date(txn.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const isReversed = txn.status === 'reversed';
                    return (
                      <tr key={txn.id} className={`hover:bg-neutral-50/50 transition-colors ${isReversed ? 'bg-red-50/20 text-neutral-400' : ''}`}>
                        <td className="py-3 px-4 space-y-1">
                          <div className="font-mono text-[9px] text-neutral-400">{date}</div>
                          <div className="font-mono font-semibold text-neutral-800 text-[10px]">{txn.referenceNumber}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900">{txn.memberName}</div>
                          <div className="font-mono text-[9px] text-neutral-400">ID: {txn.employeeId}</div>
                        </td>
                        <td className="py-3 px-4 font-sans font-medium">
                          {txn.transactionType === 'deposit' && <span className="text-emerald-700">Savings Deposit</span>}
                          {txn.transactionType === 'withdrawal' && <span className="text-amber-800">Savings Withdrawal</span>}
                          {txn.transactionType === 'share_capital_contribution' && <span className="text-blue-700">Share Capital Posting</span>}
                          {txn.transactionType === 'manual_adjustment' && <span className="text-neutral-500 font-mono text-[10px]">Adjusting ledger</span>}
                          {txn.transactionType === 'reversal' && <span className="text-red-700 uppercase font-mono text-[9px]">Reversing entry</span>}
                        </td>
                        <td className="py-3 px-4 text-neutral-500 leading-relaxed max-w-xs truncate" title={txn.description || ''}>
                          {txn.description || '—'}
                          <div className="text-[9px] text-neutral-400 font-medium">Posted by: {txn.creatorName || 'System'}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-neutral-950">
                          {settings.currencySymbol}{(txn.amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${isReversed ? 'bg-red-50 text-red-500 border border-red-200 line-through' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                            {isReversed ? 'Reversed' : 'Completed'}
                          </span>
                        </td>
                        {['System Admin', 'Manager', 'Accounting Officer'].includes(currentUser.role) && (
                          <td className="py-3 px-4 text-right">
                            {!isReversed && txn.transactionType !== 'reversal' && (
                              <button onClick={() => setReversalTarget(txn)} className="text-[11px] text-red-500 hover:text-red-700 hover:underline font-semibold cursor-pointer">
                                Reverse
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {visibleCount < filteredTxns.length && (
          <div className="px-4 py-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Showing {Math.min(visibleCount, filteredTxns.length)} of {filteredTxns.length} entries</span>
            <button
              onClick={() => setVisibleCount(v => v + 50)}
              className="text-xs font-semibold text-neutral-700 hover:text-black border border-neutral-200 hover:bg-neutral-50 rounded-lg px-3 py-1.5 cursor-pointer transition-colors">
              Show 50 more
            </button>
          </div>
        )}
      </div>
      )}

      {/* Deposit Requests Tab */}
      {activeTab === 'deposits' && (
        <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xl shadow-neutral-200/20 overflow-hidden">
          <div className="p-4 border-b border-neutral-150 bg-neutral-50/40 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Member Deposit Requests</h2>
              <p className="text-xs text-neutral-400 mt-0.5">Review receipt submissions and approve to post to ledger.</p>
            </div>
            <button onClick={fetchDepositRequests} className="p-1.5 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          </div>

          {depositRequestsLoading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader className="w-5 h-5 text-neutral-400 animate-spin" />
              <span className="text-xs text-neutral-500">Loading requests...</span>
            </div>
          ) : depositRequestsList.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-neutral-300" />
              <p className="text-xs text-neutral-400">No deposit requests yet.</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <ul className="md:hidden divide-y divide-neutral-100">
                {depositRequestsList.map(dr => (
                  <li key={dr.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">{dr.memberFirstName} {dr.memberLastName}</div>
                        <div className="text-[10px] font-mono text-neutral-400">{dr.memberEmployeeId}</div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${dr.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : dr.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                        {dr.status.charAt(0).toUpperCase() + dr.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-semibold text-neutral-900">{settings.currencySymbol}{(dr.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-neutral-400">{new Date(dr.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    {dr.notes && <div className="text-[10px] text-neutral-500 italic">"{dr.notes}"</div>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setViewReceiptUrl(dr.receiptData)} className="flex-1 text-xs border border-neutral-200 rounded-lg py-1.5 hover:bg-neutral-50 cursor-pointer">View Receipt</button>
                      {dr.status === 'pending' && (
                        <button onClick={() => { setDepositReviewModal(dr); setDepositReviewNotes(''); setDepositReviewError(null); }}
                          className="flex-1 text-xs bg-neutral-900 text-white rounded-lg py-1.5 hover:bg-neutral-800 cursor-pointer">Review</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500 text-[10px] uppercase font-semibold border-b border-neutral-150">
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Receipt</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Notes</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {depositRequestsList.map(dr => (
                      <tr key={dr.id} className="hover:bg-neutral-50/40">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900">{dr.memberFirstName} {dr.memberLastName}</div>
                          <div className="text-[10px] font-mono text-neutral-400">{dr.memberEmployeeId}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-neutral-900">{settings.currencySymbol}{(dr.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4">
                          <button onClick={() => setViewReceiptUrl(dr.receiptData)} className="text-xs text-blue-600 hover:underline cursor-pointer">View</button>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dr.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : dr.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                            {dr.status.charAt(0).toUpperCase() + dr.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-neutral-400 font-mono text-[10px]">{new Date(dr.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="py-3 px-4 text-neutral-500 italic text-[11px] max-w-[180px] truncate">{dr.notes || '—'}</td>
                        <td className="py-3 px-4 text-right">
                          {dr.status === 'pending' && (
                            <button onClick={() => { setDepositReviewModal(dr); setDepositReviewNotes(''); setDepositReviewError(null); }}
                              className="text-xs bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-1.5 rounded-lg cursor-pointer">
                              Review
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Deposit Request Review Modal */}
      {depositReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Review Deposit Request</h2>
              <p className="text-xs text-neutral-500 mt-1">
                {depositReviewModal.memberFirstName} {depositReviewModal.memberLastName} · {settings.currencySymbol}{(depositReviewModal.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Receipt preview */}
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              {depositReviewModal.receiptData?.startsWith('data:image') ? (
                <img src={depositReviewModal.receiptData} alt="Receipt" className="w-full max-h-56 object-contain bg-neutral-50 cursor-pointer" onClick={() => setViewReceiptUrl(depositReviewModal.receiptData)} />
              ) : (
                <div className="p-4 text-center text-xs text-neutral-500">Non-image receipt. <button onClick={() => setViewReceiptUrl(depositReviewModal.receiptData)} className="text-blue-600 underline cursor-pointer">View file</button></div>
              )}
            </div>

            {depositReviewError && <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{depositReviewError}</div>}

            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                Notes <span className="normal-case font-normal">(required for rejection, optional for approval)</span>
              </label>
              <textarea value={depositReviewNotes} onChange={e => setDepositReviewNotes(e.target.value)} rows={2}
                placeholder="Add a note for the member..."
                className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 resize-none" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setDepositReviewModal(null)}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2.5 rounded-lg cursor-pointer">Cancel</button>
              <button onClick={() => handleDepositReview('reject')} disabled={depositReviewing}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-1.5">
                {depositReviewing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Reject
              </button>
              <button onClick={() => handleDepositReview('approve')} disabled={depositReviewing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-1.5">
                {depositReviewing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Viewer Modal */}
      {viewReceiptUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setViewReceiptUrl(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewReceiptUrl(null)} className="absolute -top-9 right-0 text-white text-xs flex items-center gap-1 cursor-pointer">
              <X className="w-4 h-4" /> Close
            </button>
            <img src={viewReceiptUrl} alt="Receipt" className="w-full rounded-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

      {/* POST NEW TRANSACTION MODAL */}
      <AnimatePresence>
        {showPostingModal && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-neutral-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-neutral-150 bg-neutral-50/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900 font-sans">
                  Post Double-Entry Activity
                </h2>
                <button
                  onClick={() => setShowPostingModal(false)}
                  className="p-1 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-black cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handlePostTransaction} className="p-6 space-y-4">
                {/* Select Member — Searchable */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-neutral-400">
                    Recipient Member
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 h-9 bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      placeholder="Search by name or employee ID..."
                      value={memberSearch}
                      onChange={(e) => {
                        setMemberSearch(e.target.value);
                        setSelectedMemberId('');
                        setMemberSearchOpen(true);
                      }}
                      onFocus={() => setMemberSearchOpen(true)}
                      onBlur={() => setTimeout(() => setMemberSearchOpen(false), 150)}
                      required={!selectedMemberId}
                    />
                    <input type="text" value={selectedMemberId} onChange={() => {}} required className="sr-only" tabIndex={-1} />

                    {memberSearchOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                        {(() => {
                          const filtered = membersList.filter(m => m.isActive && (
                            !memberSearch ||
                            `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
                            m.employeeId.toLowerCase().includes(memberSearch.toLowerCase())
                          ));
                          if (filtered.length === 0) return (
                            <div className="px-3 py-3 text-xs text-neutral-400 text-center">No members found.</div>
                          );
                          return filtered.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onMouseDown={() => {
                                setSelectedMemberId(String(m.id));
                                setMemberSearch(`${m.firstName} ${m.lastName} (${m.employeeId})`);
                                setMemberSearchOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2.5 text-xs border-b border-neutral-100 last:border-0 transition-colors ${
                                selectedMemberId === String(m.id)
                                  ? 'bg-neutral-900 text-white'
                                  : 'hover:bg-neutral-50 text-neutral-800'
                              }`}
                            >
                              <div className="font-semibold truncate">{m.firstName} {m.lastName}</div>
                              <div className={`font-mono text-[10px] mt-0.5 ${selectedMemberId === String(m.id) ? 'text-neutral-300' : 'text-neutral-400'}`}>
                                {m.employeeId}
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                  {selectedMemberId && (
                    <p className="text-[10px] text-emerald-600 font-medium pl-1">✓ Member selected</p>
                  )}
                </div>

                {/* Select Type */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-neutral-400">
                    Ledger Posting Type
                  </label>
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as any)}
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 h-9 bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-300 cursor-pointer"
                    required
                  >
                    <option value="deposit">Deposit to Savings Account (Credit 2010 / Debit 1010)</option>
                    <option value="withdrawal">Withdrawal from Savings Account (Debit 2010 / Credit 1010)</option>
                    <option value="share_capital_contribution">Share Capital Contribution (Credit 3010 / Debit 1010)</option>
                    {['System Admin', 'Accounting Officer', 'Manager'].includes(currentUser.role) && (
                      <option value="manual_adjustment">Manual Adjusted Journal Heading (Custom COAs)</option>
                    )}
                  </select>
                </div>

                {/* For Manual adjustment: show Debit/Credit COAs */}
                {transactionType === 'manual_adjustment' && (
                  <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-3 rounded-lg border border-neutral-200/55">
                    <div className="space-y-1">
                      <label className="block text-[9px] uppercase font-bold text-neutral-400">
                        Debit Account (Receiving)
                      </label>
                      <select
                        value={manualDebitCoa}
                        onChange={(e) => setManualDebitCoa(e.target.value)}
                        className="w-full text-[11px] border border-neutral-200 rounded p-1.5 bg-white text-neutral-800"
                      >
                        {coaList.map(coa => (
                          <option key={coa.code} value={coa.code}>{coa.code} - {coa.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] uppercase font-bold text-neutral-400">
                        Credit Account (Paying)
                      </label>
                      <select
                        value={manualCreditCoa}
                        onChange={(e) => setManualCreditCoa(e.target.value)}
                        className="w-full text-[11px] border border-neutral-200 rounded p-1.5 bg-white text-neutral-800"
                      >
                        {coaList.map(coa => (
                          <option key={coa.code} value={coa.code}>{coa.code} - {coa.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-neutral-400">
                    Posting Amount ({settings.currencySymbol})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-neutral-400 font-mono">{settings.currencySymbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      className="w-full text-xs pl-8 pr-4 py-2 border border-neutral-200 rounded-md bg-white focus:outline-none text-neutral-800 font-mono"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Description Memo */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-neutral-400">
                    Posting Description Memo
                  </label>
                  <textarea
                    placeholder="Provide detailed description or banking receipt reference info..."
                    className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none text-neutral-800 h-20 leading-relaxed"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                {errMsg && (
                  <div className="p-3 bg-red-50 border border-red-150 text-red-600 text-xs rounded-md">
                    {errMsg}
                  </div>
                )}

                <div className="pt-4 border-t border-neutral-150 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPostingModal(false)}
                    className="text-xs font-semibold text-neutral-500 hover:text-black py-2 px-4 border border-neutral-200 hover:border-neutral-300 rounded-md transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={posting}
                    className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-semibold py-2 px-4 rounded-md shadow-sm transition-all cursor-pointer whitespace-nowrap"
                  >
                    {posting ? 'Posting...' : 'Commit Transaction'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REVERSAL MODAL */}
      <AnimatePresence>
        {reversalTarget && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="bg-white border border-neutral-300 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 border-b border-neutral-150 bg-neutral-50/50 flex items-center justify-between text-neutral-900">
                <div className="flex items-center gap-1.5 font-sans font-semibold text-xs">
                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                  <span>Immutability Reversal Gate</span>
                </div>
                <button
                  onClick={() => setReversalTarget(null)}
                  className="p-1 rounded-full hover:bg-neutral-200 text-neutral-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleReverseTransaction} className="p-5 space-y-4">
                <div className="text-xs text-neutral-600 leading-relaxed bg-red-50/50 border border-red-100 p-3 rounded-lg space-y-1.5">
                  <p>
                    You are reversing transaction <strong className="font-mono text-neutral-950">{reversalTarget.referenceNumber}</strong> in the value of <strong>{settings.currencySymbol}{(reversalTarget.amount/100).toFixed(2)}</strong>.
                  </p>
                  <p className="text-[10px] text-neutral-500">
                    Our cooperative ledger is immutable. Reversing this transaction generates an opposing double-entry journal headed under a balanced ledger code. The original journal lines remain visible and linked showing complete auditing integrity.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-neutral-400">
                    Reversal Reason (Auditing Required)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter explicit explanation for auditors..."
                    className="w-full text-xs border border-neutral-200 p-2 rounded-md bg-white text-neutral-800"
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    required
                  />
                </div>

                {errMsg && (
                  <div className="p-2 bg-red-50 text-red-650 text-[11px] rounded border border-red-100">
                    {errMsg}
                  </div>
                )}

                <div className="pt-2 border-t border-neutral-150 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReversalTarget(null)}
                    className="text-xs font-semibold text-neutral-500 hover:text-black py-2 px-3 border border-neutral-200 rounded hover:bg-neutral-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reversing}
                    className="bg-red-500 hover:bg-red-650 disabled:bg-neutral-300 text-white text-xs font-semibold py-2 px-4 rounded shadow-sm cursor-pointer"
                  >
                    {reversing ? 'Posting counterpart lines...' : 'Post Reversal Ledger'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
