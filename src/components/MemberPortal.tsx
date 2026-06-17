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
  Info
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
    <div className="flex-grow p-8 overflow-y-auto h-screen print:p-0">
      {/* Top Banner */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-neutral-900 font-sans">
            My Cooperative Account
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Welcome back, {memberDetails.firstName}. Monitor savings deposits and capital contributions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMemberPortalData}
            className="p-1.5 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer text-xs"
            title="Refresh values"
          >
            Refreshed
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
        <div className="grid grid-cols-3 gap-6">
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
            <table className="w-full text-left text-xs border-collapse">
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
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
