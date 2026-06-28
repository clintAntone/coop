import React, { useState, useEffect } from 'react';
import { TrialBalanceItem, MemberSummary, AuditLog, User, AppSettings } from '../types.ts';
import InfoButton from './InfoButton.tsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import {
  LineChart as ChartIcon,
  ShieldCheck,
  FileSpreadsheet,
  History,
  CheckCircle,
  Loader,
  RefreshCw,
  Search,
  DollarSign,
  Layers,
  Sparkles,
  Info,
  Download,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface ReportsModuleProps {
  currentUser: User;
  token: string;
  settings: AppSettings;
}

export default function ReportsModule({ currentUser, token, settings }: ReportsModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<'trial' | 'members' | 'audit'>('trial');
  const [trialBalanceList, setTrialBalanceList] = useState<TrialBalanceItem[]>([]);
  const [memberSummaries, setMemberSummaries] = useState<MemberSummary[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Search states inside tabs
  const [memberSearch, setMemberSearch] = useState('');

  const [memberSortField, setMemberSortField] = useState<'name' | 'savings' | 'shareCapital' | 'total'>('name');
  const [memberSortDir, setMemberSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadTabReport();
  }, [token, activeSubTab]);

  const loadTabReport = async () => {
    setIsLoading(true);
    setErrMsg(null);
    try {
      if (activeSubTab === 'trial') {
        const res = await fetch('/api/reports/trial-balance', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Could not retrieve Live Trial Balance reports.');
        const data = await res.json();
        setTrialBalanceList(data);
      } else if (activeSubTab === 'members') {
        const res = await fetch('/api/reports/members-summaries', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Could not retrieve comprehensive Members Balance ledger summary list.');
        const data = await res.json();
        setMemberSummaries(data);
      } else if (activeSubTab === 'audit') {
        const res = await fetch('/api/reports/audit-logs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Could not download cooperative security and activity logs.');
        const data = await res.json();
        setAuditLogsList(data);
      }
    } catch (err: any) {
      console.error(err);
      setErrMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-calculate sums for Trial Balance
  const totalDebitSum = trialBalanceList.reduce((acc, curr) => acc + curr.debit, 0);
  const totalCreditSum = trialBalanceList.reduce((acc, curr) => acc + curr.credit, 0);
  const accountsAreBalanced = Math.abs(totalDebitSum - totalCreditSum) < 1; // within margin of cents rounding

  // Pre-calculate aggregate capital for chart
  const totalSavingsAgg = memberSummaries.reduce((acc, curr) => acc + Math.max(0, curr.savings), 0);
  const totalEquityAgg = memberSummaries.reduce((acc, curr) => acc + Math.max(0, curr.shareCapital), 0);

  const chartData = [
    {
      name: 'Cooperative Capital Distribution',
      'Savings Liability (2010)': totalSavingsAgg / 100,
      'Share Capital Equity (3010)': totalEquityAgg / 100,
    }
  ];

  const filteredMembers = memberSummaries.filter(m => {
    const term = memberSearch.toLowerCase();
    const name = `${m.firstName} ${m.lastName}`.toLowerCase();
    return name.includes(term) || m.employeeId.toLowerCase().includes(term) || (m.department || '').toLowerCase().includes(term);
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    let cmp = 0;
    if (memberSortField === 'name') cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    else if (memberSortField === 'savings') cmp = a.savings - b.savings;
    else if (memberSortField === 'shareCapital') cmp = a.shareCapital - b.shareCapital;
    else cmp = (a.savings + a.shareCapital) - (b.savings + b.shareCapital);
    return memberSortDir === 'asc' ? cmp : -cmp;
  });

  const toggleMemberSort = (field: 'name' | 'savings' | 'shareCapital' | 'total') => {
    if (memberSortField === field) setMemberSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setMemberSortField(field); setMemberSortDir('asc'); }
  };

  const exportTrialBalanceCsv = () => {
    const headers = ['COA Code', 'Account Name', 'Type', 'Normal Balance', 'Gross Debits', 'Gross Credits', 'Net Trial Debit', 'Net Trial Credit'];
    const rows = trialBalanceList.map(coa => [
      coa.code,
      coa.name,
      coa.type,
      coa.normalBalance,
      (coa.debitSum / 100).toFixed(2),
      (coa.creditSum / 100).toFixed(2),
      coa.debit > 0 ? (coa.debit / 100).toFixed(2) : '',
      coa.credit > 0 ? (coa.credit / 100).toFixed(2) : '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `trial-balance-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-grow p-4 md:p-8 overflow-y-auto h-screen">
      {/* Top Title Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-neutral-900 font-sans">
            Financial Intelligence & Audits
          </h1>
          <p className="text-xs text-neutral-400 mt-1 hidden sm:block">
            Real-time dual balance reports, subsidiary ledgers audit trails, and security trace entries.
          </p>
        </div>

        {/* Tab Selector Links */}
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg border border-neutral-200 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveSubTab('trial')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeSubTab === 'trial'
                ? 'bg-white text-neutral-900 shadow'
                : 'text-neutral-500 hover:text-neutral-950'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Balance Check</span>
          </button>
          <button
            onClick={() => setActiveSubTab('members')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeSubTab === 'members'
                ? 'bg-white text-neutral-900 shadow'
                : 'text-neutral-500 hover:text-neutral-950'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span>Member Savings Overview</span>
          </button>
          {['System Admin', 'Manager', 'Auditor'].includes(currentUser.role) && (
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeSubTab === 'audit'
                  ? 'bg-white text-neutral-900 shadow'
                  : 'text-neutral-500 hover:text-neutral-950'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>Activity Log</span>
            </button>
          )}
        </div>
      </div>

      {errMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-650 rounded-xl mb-6 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 text-red-500 shrink-0" />
          <span>Error loading details: {errMsg}</span>
        </div>
      )}

      {/* COMPONENT LOADING WRAPPER */}
      {isLoading ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-32 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
          <Loader className="w-6 h-6 text-neutral-400 animate-spin" />
          <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">Compiling Live Auditing Map...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active TAB 1: TRIAL BALANCE */}
          {activeSubTab === 'trial' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-neutral-800 font-sans">Balance Check</h2>
                  <InfoButton text="Shows a summary of all financial accounts with their total activity. When the green banner appears, all your records are correctly balanced. If you see red, contact your accountant." />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">This shows a summary of all financial activity. Green means everything is correct.</p>
              </div>
              {/* Double-Entry balanced alert */}
              <div
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  accountsAreBalanced
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${accountsAreBalanced ? 'bg-emerald-500' : 'bg-red-500'} text-white`}>
                    <CheckCircle className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold font-sans">
                      {accountsAreBalanced ? '✓ Everything balances — your financial records are in order.' : `⚠ Something is off — the records don't balance by ${settings.currencySymbol}${(Math.abs(totalDebitSum - totalCreditSum) / 100).toFixed(2)}. Contact your accountant.`}
                    </h2>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[9px] uppercase font-bold text-neutral-400">Total Balancing sum</div>
                  <div className="font-mono text-sm font-bold">
                    {settings.currencySymbol}{(totalDebitSum / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Table Sheet */}
              <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xl shadow-neutral-200/25 overflow-hidden">
                <div className="p-4 border-b border-neutral-150 bg-neutral-50/50 flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Enterprise Chart of accounts</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={exportTrialBalanceCsv}
                      title="Export Trial Balance as CSV"
                      className="p-1 border border-neutral-200 rounded hover:bg-neutral-50 cursor-pointer text-neutral-500 hover:text-black transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={loadTabReport}
                      className="p-1 border border-neutral-200 rounded hover:bg-neutral-50 cursor-pointer text-neutral-500 hover:text-black transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Mobile cards — visible below md */}
                <div className="md:hidden divide-y divide-neutral-150">
                  {trialBalanceList.length === 0 ? (
                    <div className="py-12 text-center text-neutral-400 text-xs">No transactions posted yet.</div>
                  ) : trialBalanceList.map((coa) => (
                    <div key={coa.code} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-neutral-500 text-[10px]">{coa.code}</span>
                        <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded">
                          {coa.type}
                        </span>
                      </div>
                      <div className="font-semibold text-neutral-800 text-xs">{coa.name}</div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <div className="text-[9px] uppercase text-neutral-400 font-semibold mb-0.5">Debits</div>
                          <div className="font-mono text-[11px] text-neutral-500">
                            {settings.currencySymbol}{(coa.debitSum / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase text-neutral-400 font-semibold mb-0.5">Credits</div>
                          <div className="font-mono text-[11px] text-neutral-500">
                            {settings.currencySymbol}{(coa.creditSum / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100">
                        <div>
                          <div className="text-[9px] uppercase text-neutral-400 font-semibold mb-0.5">Net Debit</div>
                          <div className="font-mono text-[11px] font-bold text-neutral-900">
                            {coa.debit > 0 ? `${settings.currencySymbol}${(coa.debit / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase text-neutral-400 font-semibold mb-0.5">Net Credit</div>
                          <div className="font-mono text-[11px] font-bold text-neutral-950">
                            {coa.credit > 0 ? `${settings.currencySymbol}${(coa.credit / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table — hidden on mobile */}
                <div className="hidden md:block">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 text-neutral-500 text-[10px] uppercase font-semibold border-b border-neutral-150">
                        <th className="py-3 px-4 w-28">COA Account Code</th>
                        <th className="py-3 px-4">Account Label</th>
                        <th className="py-3 px-4">Normal Balance</th>
                        <th className="py-3 px-4 text-right">Gross Debits</th>
                        <th className="py-3 px-4 text-right">Gross Credits</th>
                        <th className="py-3 px-4 text-right w-36">Net Trial Debit</th>
                        <th className="py-3 px-4 text-right w-36">Net Trial Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-150 bg-white">
                      {trialBalanceList.length === 0 ? (
                        <tr><td colSpan={7} className="py-12 text-center text-neutral-400 text-xs">No transactions posted yet.</td></tr>
                      ) : trialBalanceList.map((coa) => (
                        <tr key={coa.code} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-bold text-neutral-500 text-[10px]">
                            {coa.code}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-neutral-800">{coa.name}</div>
                            <div className="text-[9px] uppercase text-neutral-400 font-semibold">{coa.type}</div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[10px] text-neutral-400 uppercase">
                            {coa.normalBalance}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-neutral-500 text-[11px]">
                            {settings.currencySymbol}{(coa.debitSum / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-neutral-500 text-[11px]">
                            {settings.currencySymbol}{(coa.creditSum / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-neutral-900 text-[11px] bg-neutral-50/10">
                            {coa.debit > 0 ? `${settings.currencySymbol}${(coa.debit / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-neutral-950 text-[11px] bg-neutral-50/15 border-l border-neutral-100">
                            {coa.credit > 0 ? `${settings.currencySymbol}${(coa.credit / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-900 text-white font-mono font-bold text-[11px] border-t-2 border-neutral-900">
                        <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-[10px]">
                          Balanced Ledger Grand Sum:
                        </td>
                        <td className="py-3 px-4 text-right">
                          {settings.currencySymbol}{(totalDebitSum / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right border-l border-neutral-700">
                          {settings.currencySymbol}{(totalCreditSum / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Active TAB 2: MEMBER SAVINGS OVERVIEW */}
          {activeSubTab === 'members' && (
            <div className="space-y-8">
              {/* Aggregate Capital charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-start">
                {/* Aggregate Numeric Summary */}
                <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Member Savings Overview
                    </h3>
                    <InfoButton text="Shows the savings balance and membership investment for every member. Use the search box to find a specific member, and click column headers to sort." />
                  </div>
                  <div className="space-y-4 divide-y divide-neutral-100">
                    <div className="pt-0">
                      <div className="text-[10px] uppercase text-neutral-400 font-semibold">Total Savings on Lock (2010)</div>
                      <div className="text-[20px] font-semibold text-neutral-900 font-sans tracking-tight pt-1">
                        {settings.currencySymbol}{(totalSavingsAgg / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="pt-3">
                      <div className="text-[10px] uppercase text-neutral-400 font-semibold">Total Membership Investment (3010)</div>
                      <div className="text-[20px] font-semibold text-neutral-900 font-sans tracking-tight pt-1">
                        {settings.currencySymbol}{(totalEquityAgg / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="pt-3 flex justify-between items-center text-[11px]">
                      <span className="text-neutral-500 font-medium">Summed Active Vault:</span>
                      <strong className="text-neutral-900 font-mono">
                        {settings.currencySymbol}{((totalSavingsAgg + totalEquityAgg) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* chart section */}
                <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm col-span-2 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                      <XAxis dataKey="name" stroke="#a3a3a3" fontSize={11} tickLine={false} />
                      <YAxis stroke="#a3a3a3" fontSize={11} tickFormatter={(v) => `${settings.currencySymbol}${v.toLocaleString()}`} tickLine={false} />
                      <Tooltip formatter={(value: any) => [`${settings.currencySymbol}${value.toLocaleString()}`, '']} />
                      <Legend iconSize={10} verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Savings Liability (2010)" fill="#171717" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Share Capital Equity (3010)" fill="#d4d4d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Members summaries detailed list */}
              <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xl shadow-neutral-200/25 overflow-hidden">
                <div className="p-4 border-b border-neutral-150 bg-neutral-50/50 flex justify-between items-center">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search member summaries by Name, ID, Dept..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full text-xs pl-9 pr-4 py-2 border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400 text-neutral-800 placeholder-neutral-400"
                    />
                  </div>
                </div>
                {/* Mobile cards — visible below md */}
                <div className="md:hidden divide-y divide-neutral-150">
                  {filteredMembers.length === 0 ? (
                    <div className="py-12 text-center text-neutral-400 text-xs">No members match your search.</div>
                  ) : sortedMembers.map(m => {
                    const netSummary = m.savings + m.shareCapital;
                    return (
                      <div key={m.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-neutral-800 text-xs">{m.firstName} {m.lastName}</span>
                          <span className="font-mono text-[10px] text-neutral-400">{m.employeeId}</span>
                        </div>
                        {m.department && (
                          <div className="text-[10px] text-neutral-500 uppercase font-semibold">{m.department}</div>
                        )}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div>
                            <div className="text-[9px] uppercase text-neutral-400 font-semibold mb-0.5">Savings (2010)</div>
                            <div className="font-mono text-[11px] font-medium text-neutral-900">
                              {settings.currencySymbol}{(m.savings / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-neutral-400 font-semibold mb-0.5">Share Capital (3010)</div>
                            <div className="font-mono text-[11px] font-medium text-neutral-900">
                              {settings.currencySymbol}{(m.shareCapital / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-neutral-400 font-semibold mb-0.5">Total</div>
                            <div className="font-mono text-[11px] font-bold text-neutral-950">
                              {settings.currencySymbol}{(netSummary / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table — hidden on mobile */}
                <div className="hidden md:block">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 text-neutral-500 text-[10px] uppercase font-semibold border-b border-neutral-150">
                        <th className="py-2.5 px-4 w-28">Employee ID</th>
                        <th className="py-2.5 px-4 cursor-pointer select-none hover:bg-neutral-100/50 transition-colors" onClick={() => toggleMemberSort('name')}>
                          <span className="flex items-center gap-1">Member Name {memberSortField === 'name' ? (memberSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}</span>
                        </th>
                        <th className="py-2.5 px-4">Department</th>
                        <th className="py-2.5 px-4 text-right cursor-pointer select-none hover:bg-neutral-100/50 transition-colors" onClick={() => toggleMemberSort('savings')}>
                          <span className="flex items-center justify-end gap-1">Savings Ledger (2010) {memberSortField === 'savings' ? (memberSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}</span>
                        </th>
                        <th className="py-2.5 px-4 text-right cursor-pointer select-none hover:bg-neutral-100/50 transition-colors" onClick={() => toggleMemberSort('shareCapital')}>
                          <span className="flex items-center justify-end gap-1">Share Capital (3010) {memberSortField === 'shareCapital' ? (memberSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}</span>
                        </th>
                        <th className="py-2.5 px-4 text-right w-40 bg-neutral-50/10 cursor-pointer select-none hover:bg-neutral-100/50 transition-colors" onClick={() => toggleMemberSort('total')}>
                          <span className="flex items-center justify-end gap-1">Summary Balances {memberSortField === 'total' ? (memberSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-150 bg-white">
                      {filteredMembers.length === 0 ? (
                        <tr><td colSpan={6} className="py-12 text-center text-neutral-400 text-xs">No members match your search.</td></tr>
                      ) : sortedMembers.map(m => {
                        const netSummary = m.savings + m.shareCapital;
                        return (
                          <tr key={m.id} className="hover:bg-neutral-50/50 transition-colors">
                            <td className="py-2.5 px-4 font-mono text-neutral-500 text-[10px]">{m.employeeId}</td>
                            <td className="py-2.5 px-4 font-semibold text-neutral-800">{m.firstName} {m.lastName}</td>
                            <td className="py-2.5 px-4 text-neutral-500">{m.department || '—'}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-medium text-neutral-900">
                              {settings.currencySymbol}{(m.savings / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-medium text-neutral-900 border-r border-neutral-100">
                              {settings.currencySymbol}{(m.shareCapital / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-neutral-950 bg-neutral-50/10">
                              {settings.currencySymbol}{(netSummary / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Active TAB 3: ACTIVITY LOG (AUDIT LOGS) */}
          {activeSubTab === 'audit' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-neutral-800 font-sans">Activity Log</h2>
                  <InfoButton text="A chronological record of all important actions taken in the system — approvals, role changes, reversals, and account creation. Useful for audits and accountability." />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">A record of all important actions taken in the system.</p>
              </div>
              <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xl shadow-neutral-200/25 overflow-hidden">
                <div className="p-4 border-b border-neutral-150 bg-neutral-50/50 flex justify-between items-center text-xs">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Activity Log</span>
                  <div className="text-[10px] text-neutral-400 font-medium">Chronological activities logs</div>
                </div>
                {auditLogsList.length === 0 ? (
                  <div className="py-24 text-center max-w-sm mx-auto flex flex-col items-center gap-2">
                    <History className="w-10 h-10 text-neutral-300" />
                    <h3 className="text-xs font-semibold text-neutral-800">No Activity Yet</h3>
                    <p className="text-[11px] text-neutral-400">No important actions have been recorded yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-150">
                    {auditLogsList.map((log) => {
                      const dateStr = new Date(log.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });
                      return (
                        <div key={log.id} className="hover:bg-neutral-50/30 transition-colors text-xs">
                          {/* Mobile layout: stacked card — hidden on md+ */}
                          <div className="md:hidden p-4 space-y-2">
                            <div className="font-semibold text-neutral-800 uppercase font-mono text-[10px] tracking-wide">
                              {log.action}
                            </div>
                            <p className="text-neutral-500 leading-relaxed text-[11px]">
                              {log.details || '—'}
                            </p>
                            <div className="flex items-center justify-between pt-1 gap-2">
                              <span className="font-mono text-[9px] text-neutral-400">{dateStr}</span>
                              <div className="text-right">
                                <div className="font-semibold text-neutral-900 text-[11px]">{log.userName || 'System Seat'}</div>
                                <div className="font-mono text-[9px] text-neutral-400 truncate">{log.userEmail}</div>
                              </div>
                            </div>
                          </div>

                          {/* Desktop layout: side-by-side — hidden on mobile */}
                          <div className="hidden md:flex items-start gap-4 p-4">
                            {/* Left Column: DateTime */}
                            <div className="w-36 font-mono text-[9px] text-neutral-400 pt-0.5 shrink-0">
                              {dateStr}
                            </div>

                            {/* Middle Column: details */}
                            <div className="flex-grow space-y-1">
                              <div className="font-semibold text-neutral-800 uppercase font-mono text-[10px] tracking-wide">
                                {log.action}
                              </div>
                              <p className="text-neutral-500 leading-relaxed text-[11px]">
                                {log.details || '—'}
                              </p>
                            </div>

                            {/* Right Column: Actor */}
                            <div className="w-48 text-right shrink-0">
                              <div className="font-semibold text-neutral-900">{log.userName || 'System Seat'}</div>
                              <div className="font-mono text-[9px] text-neutral-400 truncate">{log.userEmail}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
