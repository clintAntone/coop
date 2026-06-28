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
  Upload,
  X,
  Camera,
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

  // Deposit request state
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositReceipt, setDepositReceipt] = useState<string | null>(null);
  const [depositReceiptName, setDepositReceiptName] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [depositAmountTouched, setDepositAmountTouched] = useState(false);
  const [depositReceiptMissing, setDepositReceiptMissing] = useState(false);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchMemberPortalData();
  }, [token]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showLoanForm) { setShowLoanForm(false); setLoanError(null); }
        if (showDepositForm) setShowDepositForm(false);
        if (viewReceiptUrl) setViewReceiptUrl(null);
        if (cancelConfirmId !== null) setCancelConfirmId(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showLoanForm, showDepositForm, viewReceiptUrl, cancelConfirmId]);

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

      // 5. Fetch member's deposit requests
      const resDeposits = await fetch('/api/deposit-requests/my', { headers: { Authorization: `Bearer ${token}` } });
      if (resDeposits.ok) setDepositRequests(await resDeposits.json());
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

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);
    setDepositAmountTouched(true);
    const amountCents = Math.round(parseFloat(depositAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    if (!depositReceipt) { setDepositReceiptMissing(true); return; }
    setDepositSubmitting(true);
    try {
      const res = await fetch('/api/deposit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountCents, receiptData: depositReceipt }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setDepositSuccess(true);
      setDepositAmount('');
      setDepositReceipt(null);
      setDepositReceiptName('');
      setDepositAmountTouched(false);
      setDepositReceiptMissing(false);
      setShowDepositForm(false);
      const resDeposits = await fetch('/api/deposit-requests/my', { headers: { Authorization: `Bearer ${token}` } });
      if (resDeposits.ok) setDepositRequests(await resDeposits.json());
      setTimeout(() => setDepositSuccess(false), 5000);
    } catch (err: any) {
      setDepositError(err.message);
    } finally {
      setDepositSubmitting(false);
    }
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setDepositError('Receipt image must be under 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setDepositReceipt(reader.result as string); setDepositReceiptName(file.name); };
    reader.readAsDataURL(file);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8 print:hidden">
        <div className="min-w-0">
          <h1 className="text-xl font-medium tracking-tight text-neutral-900 font-sans">
            My Cooperative Account
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Welcome back, {memberDetails.firstName}.
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 sm:self-auto">
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
              className="p-1.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-lg shadow-sm cursor-pointer"
              title="Print Ledger"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => { setShowDepositForm(true); setDepositError(null); setDepositAmount(''); setDepositReceipt(null); setDepositReceiptName(''); setDepositAmountTouched(false); setDepositReceiptMissing(false); }}
            className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-3 rounded-lg cursor-pointer transition-colors ml-auto sm:ml-2">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Request Deposit</span>
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
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Membership Investment</span>
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
          ) : (() => {
            const TRANSACTION_TYPE_LABELS: Record<string, string> = {
              share_capital_contribution: 'Membership Investment',
              manual_adjustment: 'Custom Entry',
              reversal: 'Undone',
            };
            // Sort by date ascending to compute running balance
            const sortedLines = [...ledgerLines].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            let runningBalance = 0;
            const linesWithBalance = sortedLines.map(line => {
              if (line.status !== 'reversed') {
                if (line.entryType === 'credit') runningBalance += line.amount;
                else runningBalance -= line.amount;
              }
              return { ...line, runningBalance };
            });
            // Re-sort back to original order for display (preserve original ledgerLines order, just attach balance)
            const balanceById: Record<number, number> = {};
            linesWithBalance.forEach(l => { balanceById[l.id] = l.runningBalance; });
            const finalBalance = linesWithBalance[linesWithBalance.length - 1]?.runningBalance ?? 0;
            return (
              <div className="overflow-x-auto"><table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-500 text-[10px] uppercase font-semibold border-b border-neutral-150 print:bg-neutral-100">
                    <th className="py-2.5 px-4 w-28">Date</th>
                    <th className="py-2.5 px-4">Description Mem</th>
                    <th className="py-2.5 px-4">Account COA</th>
                    <th className="py-2.5 px-4 text-right">Money Out</th>
                    <th className="py-2.5 px-4 text-right">Money In</th>
                    <th className="py-2.5 px-4 text-right">Balance</th>
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
                    const displayDescription = TRANSACTION_TYPE_LABELS[line.description] ?? line.description;
                    return (
                      <tr
                        key={line.id}
                        className={`hover:bg-neutral-50/50 transition-colors ${
                          isReversed ? 'bg-red-50/20 text-neutral-400 line-through' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-[10px] text-neutral-500">{lineDate}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-850">{displayDescription}</div>
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
                        <td className="py-3 px-4 text-right font-mono text-[11px] text-neutral-600">
                          {settings.currencySymbol}{(balanceById[line.id] / 100).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-50 border-t-2 border-neutral-200 font-mono font-bold text-[11px]">
                    <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-[10px] text-neutral-500">Totals</td>
                    <td className="py-3 px-4 text-right text-neutral-900">
                      {settings.currencySymbol}{(ledgerLines.filter(l => l.entryType === 'debit' && l.status !== 'reversed').reduce((s, l) => s + l.amount, 0) / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700">
                      {settings.currencySymbol}{(ledgerLines.filter(l => l.entryType === 'credit' && l.status !== 'reversed').reduce((s, l) => s + l.amount, 0) / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-900 font-bold">
                      {settings.currencySymbol}{(finalBalance / 100).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table></div>
            );
          })()}
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

          {/* Loan progress tracker — only shown when member has at least one application */}
          {myLoanApps.length > 0 && (() => {
            const latest = [...myLoanApps].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            const status = latest.status;
            const outcomeLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : status === 'cancelled' ? 'Cancelled' : 'Decision';
            const activeStep = status === 'pending' ? 1 : (status === 'approved' || status === 'rejected' || status === 'cancelled') ? 2 : 1;
            const outcomeColor = status === 'approved' ? 'bg-emerald-500 text-white' : status === 'rejected' ? 'bg-red-500 text-white' : status === 'cancelled' ? 'bg-neutral-300 text-neutral-600' : 'bg-neutral-200 text-neutral-500';
            const outcomeConnector = status === 'approved' ? 'bg-emerald-400' : status === 'rejected' ? 'bg-red-400' : 'bg-neutral-200';
            const outcomeIcon = status === 'approved' ? ' ✓' : status === 'rejected' ? ' ✗' : '';
            return (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-5 py-4">
                <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-3">Latest Application Status</p>
                <div className="flex items-center gap-0">
                  {/* Step 0: Applied */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${activeStep >= 0 ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-500'}`}>1</div>
                    <span className="text-[10px] font-medium text-neutral-600 whitespace-nowrap">Applied</span>
                  </div>
                  {/* Connector */}
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${activeStep >= 1 ? 'bg-neutral-900' : 'bg-neutral-200'}`} />
                  {/* Step 1: Under Review */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${activeStep >= 1 ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-500'}`}>2</div>
                    <span className="text-[10px] font-medium text-neutral-600 whitespace-nowrap">Under Review</span>
                  </div>
                  {/* Connector */}
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${activeStep >= 2 ? outcomeConnector : 'bg-neutral-200'}`} />
                  {/* Step 2: Outcome */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${activeStep >= 2 ? outcomeColor : 'bg-neutral-200 text-neutral-500'}`}>3</div>
                    <span className="text-[10px] font-medium text-neutral-600 whitespace-nowrap">
                      {activeStep >= 2 ? outcomeLabel + outcomeIcon : 'Decision'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {loanProducts2.length === 0 ? (
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6 text-center">
              <FileText className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-neutral-600">Loan products not yet available</p>
              <p className="text-[11px] text-neutral-400 mt-1">The cooperative has not configured any loan products yet. Please check back later or contact your manager.</p>
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

        {/* Deposit Requests Section */}
        <div className="space-y-4 print:hidden">
          {depositSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Deposit request submitted! It will be reviewed by an accounting officer.
            </div>
          )}

          {/* Loan Application Modal */}
          {showLoanForm && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                  <h2 className="text-sm font-semibold text-neutral-900">New Loan Application</h2>
                  <button
                    type="button"
                    onClick={() => { setShowLoanForm(false); setLoanError(null); }}
                    className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleLoanSubmit}>
                  <div className="px-5 py-4 space-y-4">
                    {loanError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{loanError}</div>
                    )}

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
                      <textarea value={loanPurpose} onChange={e => setLoanPurpose(e.target.value)} required rows={3}
                        className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 resize-none"
                        placeholder="Briefly describe what this loan will be used for..." />
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-5 py-4 border-t border-neutral-100 flex gap-3">
                    <button type="button" onClick={() => { setShowLoanForm(false); setLoanError(null); }}
                      className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={loanSubmitting}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5">
                      {loanSubmitting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                      {loanSubmitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Deposit Request Modal */}
          {showDepositForm && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
              <form onSubmit={handleDepositSubmit}
                className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
                      <PlusCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-neutral-900">Request Deposit</h2>
                      <p className="text-[10px] text-neutral-400">Submit a deposit with proof of receipt for admin approval.</p>
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => { setShowDepositForm(false); setDepositError(null); setDepositReceipt(null); setDepositReceiptName(''); setDepositAmount(''); setDepositAmountTouched(false); setDepositReceiptMissing(false); }}
                    className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-black transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {depositError && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                      <XCircle className="w-3.5 h-3.5 shrink-0" /> {depositError}
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1.5">
                      Deposit Amount ({settings.currencySymbol}) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 font-mono">{settings.currencySymbol}</span>
                      <input type="number" value={depositAmount}
                        onChange={e => { setDepositAmount(e.target.value); setDepositAmountTouched(true); }}
                        onBlur={() => setDepositAmountTouched(true)}
                        min="0.01" step="0.01" autoFocus
                        className={`w-full text-sm rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 font-mono border ${
                          depositAmountTouched && (!depositAmount || parseFloat(depositAmount) <= 0)
                            ? 'border-red-300 bg-red-50 focus:ring-red-300'
                            : depositAmount && parseFloat(depositAmount) > 0
                              ? 'border-emerald-300 bg-white focus:ring-emerald-400'
                              : 'border-neutral-200 bg-white focus:ring-neutral-900'
                        }`}
                        placeholder="0.00" />
                    </div>
                    {depositAmountTouched && (!depositAmount || parseFloat(depositAmount) <= 0) && (
                      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Amount must be greater than zero.
                      </p>
                    )}
                    {depositAmount && parseFloat(depositAmount) > 0 && (
                      <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {settings.currencySymbol}{parseFloat(depositAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be requested for deposit.
                      </p>
                    )}
                  </div>

                  {/* Receipt upload */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1.5">
                      Deposit Slip / Receipt <span className="text-red-400">*</span>
                    </label>

                    {/* Two buttons: Upload file OR Take photo */}
                    {!depositReceipt && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:border-neutral-400 hover:bg-neutral-50 transition-colors ${depositReceiptMissing ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`}>
                          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={e => { handleReceiptUpload(e); setDepositReceiptMissing(false); }} />
                          <Upload className={`w-5 h-5 ${depositReceiptMissing ? 'text-red-400' : 'text-neutral-400'}`} />
                          <span className="text-xs font-medium text-neutral-600 text-center leading-tight">Upload File<br/><span className="text-[10px] font-normal text-neutral-400">JPG, PNG, PDF</span></span>
                        </label>
                        <label className={`flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:border-neutral-400 hover:bg-neutral-50 transition-colors ${depositReceiptMissing ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`}>
                          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { handleReceiptUpload(e); setDepositReceiptMissing(false); }} />
                          <Camera className={`w-5 h-5 ${depositReceiptMissing ? 'text-red-400' : 'text-neutral-400'}`} />
                          <span className="text-xs font-medium text-neutral-600 text-center leading-tight">Take Photo<br/><span className="text-[10px] font-normal text-neutral-400">Use camera</span></span>
                        </label>
                      </div>
                    )}
                    {depositReceiptMissing && !depositReceipt && (
                      <p className="text-[10px] text-red-500 mt-1.5 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Please attach a receipt or deposit slip.
                      </p>
                    )}

                    {/* Preview once uploaded */}
                    {depositReceipt && (
                      <div className="relative">
                        {depositReceipt.startsWith('data:image') ? (
                          <img src={depositReceipt} alt="Receipt preview"
                            className="w-full max-h-52 rounded-xl border border-neutral-200 object-contain bg-neutral-50" />
                        ) : (
                          <div className="flex items-center gap-3 p-3 border border-neutral-200 rounded-xl bg-neutral-50">
                            <FileText className="w-5 h-5 text-neutral-400 shrink-0" />
                            <span className="text-xs text-neutral-700 truncate">{depositReceiptName}</span>
                          </div>
                        )}
                        <button type="button"
                          onClick={() => { setDepositReceipt(null); setDepositReceiptName(''); }}
                          className="absolute top-2 right-2 bg-white border border-neutral-200 rounded-full p-1 shadow-sm hover:bg-red-50 hover:border-red-200 cursor-pointer transition-colors">
                          <X className="w-3 h-3 text-neutral-500 hover:text-red-500" />
                        </button>
                        <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {depositReceiptName || 'Receipt attached'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-4 border-t border-neutral-100 flex gap-3">
                  <button type="button"
                    onClick={() => { setShowDepositForm(false); setDepositError(null); setDepositReceipt(null); setDepositReceiptName(''); setDepositAmount(''); setDepositAmountTouched(false); setDepositReceiptMissing(false); }}
                    className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-3 rounded-xl cursor-pointer transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={depositSubmitting || !depositReceipt}
                    className="flex-1 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-semibold py-3 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2">
                    {depositSubmitting
                      ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Submitting...</>
                      : <><PlusCircle className="w-3.5 h-3.5" /> Submit Request</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Past deposit requests */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
              <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">Your Deposit History</span>
            </div>
            {depositRequests.length === 0 ? (
              <div className="py-8 text-center text-neutral-400 text-xs">No deposit requests yet.</div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {depositRequests.map(dr => (
                  <li key={dr.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 font-mono">{settings.currencySymbol}{(dr.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">{new Date(dr.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      {dr.notes && dr.status === 'rejected' && <div className="text-[10px] text-red-500 mt-0.5 italic">"{dr.notes}"</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setViewReceiptUrl(dr.receiptData)} className="text-[10px] text-neutral-400 hover:text-neutral-700 underline cursor-pointer">View Receipt</button>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        dr.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        dr.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>{dr.status.charAt(0).toUpperCase() + dr.status.slice(1)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Receipt Viewer Modal */}
      {viewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setViewReceiptUrl(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewReceiptUrl(null)} className="absolute -top-10 right-0 text-white text-xs flex items-center gap-1 cursor-pointer">
              <X className="w-4 h-4" /> Close
            </button>
            <img src={viewReceiptUrl} alt="Receipt" className="w-full rounded-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

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
