import React, { useState, useEffect } from 'react';
import { Member, LedgerLine, User, AppSettings } from '../types.ts';
import { safeReadJson } from '../lib/safe-fetch.ts';
import { motion } from 'motion/react';
import {
  Coins,
  FileText,
  TrendingDown,
  TrendingUp,
  Loader,
  XCircle,
  PiggyBank,
  Download,
  Printer,
  Calendar,
  Layers,
  Sparkles,
  Info,
  CheckCircle,
  PlusCircle,
  Ban,
  RefreshCw,
} from 'lucide-react';

interface MemberPortalProps {
  currentUser: User;
  token: string;
  settings: AppSettings;
}

export default function MemberPortal({ currentUser, token, settings }: MemberPortalProps) {
  const [memberDetails, setMemberDetails] = useState<Member | null>(null);
  const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Loan application state
  const [loanProducts2, setLoanProducts2] = useState<any[]>([]);
  const [myLoanApps, setMyLoanApps] = useState<any[]>([]);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanProductId, setLoanProductId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTerm, setLoanTerm] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [loanSuccess, setLoanSuccess] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);

  useEffect(() => {
    fetchMemberPortalData();
  }, [token]);

  const fetchMemberPortalData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Fetch self member record with derived balances
      const resDetails = await fetch('/api/members/self', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resDetails.ok) {
        let errorMsg = 'Your profile is not yet linked to an active cooperative Member profile. Ask an Accounting Officer or Manager to assign your Google account address to your Employee ID record.';
        try {
          const err = await safeReadJson(resDetails);
          errorMsg = err.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const details = await safeReadJson(resDetails);
      setMemberDetails(details);

      // 2. Fetch ledger statement transactions history
      const resLedger = await fetch(`/api/reports/member-ledger/${details.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resLedger.ok) throw new Error('Could not retrieve cooperative statement logs from database.');

      const ledger = await safeReadJson(resLedger);
      setLedgerLines(ledger);

      // 3. Fetch active loan products
      const resProducts = await fetch('/api/terms/loan-products', { headers: { Authorization: `Bearer ${token}` } });
      if (resProducts.ok) {
        const products = await resProducts.json();
        setLoanProducts2(products.filter((p: any) => p.isActive));
      }

      // 4. Fetch member's loan applications
      const resApps = await fetch('/api/loan-applications/my', { headers: { Authorization: `Bearer ${token}` } });
      if (resApps.ok) setMyLoanApps(await resApps.json());
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanError(null);
    const selectedProduct = loanProducts2.find(p => p.id === parseInt(loanProductId));
    if (!selectedProduct) { setLoanError('Please select a loan product.'); return; }
    const amountCents = Math.round(parseFloat(loanAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) { setLoanError('Amount must be greater than zero.'); return; }
    if (selectedProduct && amountCents < selectedProduct.minAmountCents) {
      setLoanError(`Minimum loan amount is ${settings.currencySymbol}${(selectedProduct.minAmountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
      return;
    }
    if (selectedProduct && amountCents > selectedProduct.maxAmountCents) {
      setLoanError(`Maximum loan amount is ${settings.currencySymbol}${(selectedProduct.maxAmountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
      return;
    }
    const term = parseInt(loanTerm);
    if (isNaN(term) || term <= 0) { setLoanError('Enter a valid term.'); return; }
    if (!loanPurpose.trim()) { setLoanError('Please describe the purpose.'); return; }
    setLoanSubmitting(true);
    try {
      const res = await fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ loanProductId: parseInt(loanProductId), requestedAmountCents: amountCents, termMonths: term, purpose: loanPurpose }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setLoanSuccess(true);
      setShowLoanForm(false);
      setLoanAmount(''); setLoanTerm(''); setLoanPurpose(''); setLoanProductId('');
      // Re-fetch applications
      const resApps = await fetch('/api/loan-applications/my', { headers: { Authorization: `Bearer ${token}` } });
      if (resApps.ok) setMyLoanApps(await resApps.json());
    } catch (err: any) {
      setLoanError(err.message);
    } finally {
      setLoanSubmitting(false);
    }
  };

  const handleCancelApp = async (id: number) => {
    try {
      await fetch(`/api/loan-applications/${id}/cancel`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const resApps = await fetch('/api/loan-applications/my', { headers: { Authorization: `Bearer ${token}` } });
      if (resApps.ok) setMyLoanApps(await resApps.json());
    } catch {}
    setCancelConfirmId(null);
  };

  if (isLoading) {
    return (
      <div className="flex-grow p-8 flex flex-col items-center justify-center gap-3 h-screen">
        <Loader className="w-6 h-6 text-neutral-400 animate-spin" />
        <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">Syncing Personal Vault...</span>
      </div>
    );
  }

  if (errorMessage || !memberDetails) {
    return (
      <div className="flex-grow p-8 flex flex-col items-center justify-center h-screen max-w-lg mx-auto text-center gap-4">
        <XCircle className="w-10 h-10 text-neutral-400 shrink-0" />
        <h1 className="text-base font-semibold text-neutral-900">Portal Linking Action Required</h1>
        <p className="text-xs text-neutral-500 leading-relaxed bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
          {errorMessage || 'Your user credentials have not been associated with a cooperative member registry yet.'}
        </p>
        <div className="text-[11px] text-neutral-400 max-w-xs leading-normal">
          Provide your login account Address (<strong>{currentUser.email}</strong>) to your system manager to establish the secure lookup link.
        </div>
        <button
          onClick={fetchMemberPortalData}
          className="text-xs bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 font-semibold py-1.5 px-4 rounded-lg mt-2 cursor-pointer shadow-sm"
        >
          Re-Check Linking
        </button>
      </div>
    );
  }

  const balances = memberDetails.balances;

  return (
    <div className="flex-grow p-4 md:p-8 overflow-y-auto h-screen print:p-0">
      {/* Top Banner */}
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-8 print:hidden">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-neutral-900 font-sans">
            My Cooperative Account
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 hidden sm:block">
            Welcome back, {memberDetails.firstName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMemberPortalData}
            className="p-1.5 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Ledger</span>
          </button>
        </div>
      </div>

      {/* Printable Heading */}
      <div className="hidden print:block mb-8 border-b border-neutral-300 pb-5">
        <h1 className="text-lg font-bold text-neutral-950 font-sans">COOPERATIVE MEMBER LEDGER STATEMENT</h1>
        <div className="grid grid-cols-2 gap-4 text-xs mt-3">
          <div>
            <div><strong>Member Name:</strong> {memberDetails.firstName} {memberDetails.lastName}</div>
            <div><strong>Employee ID:</strong> {memberDetails.employeeId}</div>
            <div><strong>Department:</strong> {memberDetails.department || '—'}</div>
          </div>
          <div className="text-right">
            <div><strong>Statement Date:</strong> {new Date().toLocaleDateString()}</div>
            <div><strong>Email Address:</strong> {memberDetails.email}</div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Balances Board */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Savings balance Card */}
          <div className="bg-neutral-900 text-white rounded-xl p-5 shadow-lg border border-neutral-950 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Withdrawable Savings</span>
              <PiggyBank className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="my-4">
              <div className="text-[22px] font-sans font-medium tracking-tight">
                {settings.currencySymbol}{balances ? (balances.savingsInCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </div>
              <div className="text-[9px] text-neutral-400 mt-1 font-sans">Ledger Account: 2010 (Liability)</div>
            </div>
            <p className="text-[10px] text-neutral-400 leading-normal">
              Accumulates interest. Available to withdraw by cashier request during desk hours.
            </p>
          </div>

          {/* Share Capital Equity card */}
          <div className="bg-white border border-neutral-300 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Membership Share Capital</span>
              <Coins className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="my-4">
              <div className="text-[22px] font-sans font-medium text-neutral-900 tracking-tight">
                {settings.currencySymbol}{balances ? (balances.shareCapitalInCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </div>
              <div className="text-[9px] text-neutral-500 mt-1 font-sans">Ledger Account: 3010 (Equity)</div>
            </div>
            <p className="text-[10px] text-neutral-500 leading-normal">
              Represents your paid up equity share. Earns dividend yield on annual disbursements.
            </p>
          </div>

          {/* Subsidiary Summary details card */}
          <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-5 flex flex-col justify-between print:hidden">
            <div className="space-y-1">
              <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Dynamic Membership ID
              </h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed pt-1.5">
                Your employee credentials have been securely linked under the cooperative double-entry audit engine.
              </p>
            </div>
            <div className="border-t border-neutral-200/60 pt-4 flex items-center justify-between text-xs text-neutral-600">
              <span>Security Bind:</span>
              <span className="font-mono bg-neutral-250 border border-neutral-300 rounded px-1.5 text-[10px] py-0.5 text-neutral-800">
                {memberDetails.employeeId}
              </span>
            </div>
          </div>
        </div>

        {/* Ledger Entries list card */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-xl shadow-neutral-200/20 overflow-hidden">
          <div className="p-4 border-b border-neutral-150 bg-neutral-50/50 flex justify-between items-center print:bg-white print:border-b print:pb-3">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Personal Subsidiary ledger statement</span>
            <span className="text-[10px] text-neutral-400 font-mono font-bold uppercase">All transaction rows</span>
          </div>

          {ledgerLines.length === 0 ? (
            <div className="py-24 text-center max-w-xs mx-auto flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 text-neutral-300 shrink-0" />
              <h3 className="text-xs font-semibold text-neutral-800">Statement is Empty</h3>
              <p className="text-[11px] text-neutral-400">Once your capital deposits are posted, line statements will populate here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 text-neutral-500 text-[10px] uppercase font-semibold border-b border-neutral-150 print:bg-neutral-100">
                  <th className="py-2.5 px-4 w-28">Date</th>
                  <th className="py-2.5 px-4">Description Mem</th>
                  <th className="py-2.5 px-4">Account COA</th>
                  <th className="py-2.5 px-4 text-right">Debit (Withdrawal)</th>
                  <th className="py-2.5 px-4 text-right">Credit (Deposit)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-150 bg-white">
                {ledgerLines.map((line) => {
                  const lineDate = new Date(line.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  const isReversed = line.status === 'reversed';
                  return (
                    <tr
                      key={line.id}
                      className={`hover:bg-neutral-50/50 transition-colors ${
                        isReversed ? 'bg-red-50/20 text-neutral-400 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[10px] text-neutral-500">{lineDate}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-850">{line.description}</div>
                        {line.transactionRef && (
                          <div className="text-[9px] text-neutral-400 font-mono">Ref: {line.transactionRef}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[10px] bg-neutral-100 border border-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded">
                          {line.coaCode}
                        </span>
                        <span className="text-[11px] pl-1.5 text-neutral-500">{line.coaName}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                        {line.entryType === 'debit' ? `${settings.currencySymbol}(${(line.amount / 100).toFixed(2)})` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                        {line.entryType === 'credit' ? `${settings.currencySymbol}${(line.amount / 100).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>

        {/* Loan Applications Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Loan Applications</h2>
            {loanProducts2.length > 0 && !myLoanApps.some(a => a.status === 'pending') && (
              <button
                onClick={() => { setShowLoanForm(true); setLoanError(null); setLoanSuccess(false); }}
                className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-1.5 px-3 rounded-lg cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Apply for Loan
              </button>
            )}
          </div>

          {loanSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Your loan application has been submitted and is pending review.
            </div>
          )}

          {loanProducts2.length === 0 ? (
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6 text-center">
              <FileText className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-neutral-600">Loan products not yet available</p>
              <p className="text-[11px] text-neutral-400 mt-1">The cooperative has not configured any loan products yet. Please check back later or contact your manager.</p>
            </div>
          ) : showLoanForm ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-semibold text-neutral-800">New Loan Application</h3>
              {loanError && <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{loanError}</div>}
              <form onSubmit={handleLoanSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Loan Product</label>
                  <select value={loanProductId} onChange={e => setLoanProductId(e.target.value)} required
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900">
                    <option value="">— Select a loan type —</option>
                    {loanProducts2.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.interestRateBps / 100}%/mo, max {settings.currencySymbol}{(p.maxAmountCents / 100).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  {loanProductId && (() => {
                    const p = loanProducts2.find(p => p.id === parseInt(loanProductId));
                    if (!p) return null;
                    return (
                      <p className="text-[10px] text-neutral-400 mt-1 pl-0.5">
                        Amount: {settings.currencySymbol}{(p.minAmountCents/100).toLocaleString()} – {settings.currencySymbol}{(p.maxAmountCents/100).toLocaleString()} · Max term: {p.maxTermMonths} months
                      </p>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Amount ({settings.currencySymbol})</label>
                    <input type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} required min="1" step="0.01"
                      className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono"
                      placeholder="e.g. 5000.00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Term (months)</label>
                    <input type="number" value={loanTerm} onChange={e => setLoanTerm(e.target.value)} required min="1"
                      className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono"
                      placeholder="e.g. 12" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Purpose</label>
                  <textarea value={loanPurpose} onChange={e => setLoanPurpose(e.target.value)} required rows={2}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 resize-none"
                    placeholder="Briefly describe what this loan will be used for..." />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowLoanForm(false)}
                    className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2 rounded-lg cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={loanSubmitting}
                    className="flex-1 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5">
                    {loanSubmitting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                    {loanSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            </div>
          ) : myLoanApps.length === 0 ? (
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6 text-center">
              <p className="text-xs text-neutral-500">No loan applications yet. Click <strong>Apply for Loan</strong> to get started.</p>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto"><table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] uppercase font-bold text-neutral-400">
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Term</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Applied</th>
                    <th className="py-2.5 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {myLoanApps.map(a => {
                    const statusDot = (s: string) => {
                      switch (s) {
                        case 'pending':   return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />Pending</span>;
                        case 'approved':  return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />Approved</span>;
                        case 'rejected':  return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-red-500"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />Rejected</span>;
                        case 'cancelled': return <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-neutral-400"><span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />Cancelled</span>;
                        default: return null;
                      }
                    };
                    return (
                      <tr key={a.id} className="hover:bg-neutral-50/40">
                        <td className="py-3 px-4 font-medium text-neutral-800">{a.loanProductName}</td>
                        <td className="py-3 px-4 font-mono text-neutral-900">{settings.currencySymbol}{(a.requestedAmountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-neutral-500">{a.termMonths} mo.</td>
                        <td className="py-3 px-4">{statusDot(a.status)}</td>
                        <td className="py-3 px-4 text-neutral-400 font-mono text-[10px]">{new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="py-3 px-4 text-right">
                          {a.status === 'pending' && (
                            <button onClick={() => setCancelConfirmId(a.id)}
                              className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-red-500 cursor-pointer transition-colors">
                              <Ban className="w-3 h-3" />Cancel
                            </button>
                          )}
                          {a.status === 'rejected' && a.reviewNotes && (
                            <span className="text-[10px] text-red-400 italic max-w-[160px] truncate block text-right" title={a.reviewNotes}>
                              "{a.reviewNotes}"
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Loan Confirmation Modal */}
      {cancelConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-full shrink-0">
                <Ban className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Cancel Loan Application?</h2>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">This will withdraw your pending loan application. You can re-apply at any time.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setCancelConfirmId(null)}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors">
                Keep Application
              </button>
              <button onClick={() => handleCancelApp(cancelConfirmId)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors">
                Yes, Cancel It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
