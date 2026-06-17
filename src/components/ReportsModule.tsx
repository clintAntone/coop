import React, { useState, useEffect } from 'react';
import { TrialBalanceItem, MemberSummary, AuditLog, User, AppSettings } from '../types.ts';
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
  Info
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

  return (
    <div className="flex-grow p-8 overflow-y-auto h-screen">
      {/* Top Title Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-neutral-900 font-sans">
            Financial Intelligence & Audits
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time dual balance reports, subsidiary ledgers audit trails, and security trace entries.
          </p>
        </div>

        {/* Tab Selector Links */}
        <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg border border-neutral-200">
          <button
            onClick={() => setActiveSubTab('trial')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeSubTab === 'trial'
                ? 'bg-white text-neutral-900 shadow'
                : 'text-neutral-500 hover:text-neutral-950'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Trial Balance</span>
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
            <span>Members Capital Map</span>
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
              <span>Security Traces</span>
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
              {/* Double-Entry balanced alert */}
              <div
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  accountsAreBalanced
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accountsAreBalanced ? 'bg-emerald-500' : 'bg-red-500'} text-white`}>
                    <CheckCircle className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold font-sans">
                      {accountsAreBalanced ? 'Balanced Ledger Confirmed' : 'Imbalanced Ledger Warning'}
                    </h2>
                    <p className="text-[10px] text-neutral-500 mt-0.5 leading-relaxed font-sans">
                      {accountsAreBalanced
                        ? `Auditing trace checks out perfectly! Total Net Debits match Total Net Credits exactly across all ledger codes.`
                        : `A double-entry accounting imbalance of ${settings.currencySymbol}${Math.abs(totalDebitSum - totalCreditSum / 100).toFixed(2)} was identified.`}
                    </p>
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
                  <button
                    onClick={loadTabReport}
                    className="p-1 border border-neutral-200 rounded hover:bg-neutral-50 cursor-pointer text-neutral-500 hover:text-black transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                    {trialBalanceList.map((coa) => (
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
          )}

          {/* Active TAB 2: MEMBERS CAPITAL MAP */}
          {activeSubTab === 'members' && (
            <div className="space-y-8">
              {/* Aggregate Capital charts */}
              <div className="grid grid-cols-3 gap-6 items-start">
                {/* Aggregate Numeric Summary */}
                <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Aggregate Vault Balances
                  </h3>
                  <div className="space-y-4 divide-y divide-neutral-100">
                    <div className="pt-0">
                      <div className="text-[10px] uppercase text-neutral-400 font-semibold">Total Savings on Lock (2010)</div>
                      <div className="text-[20px] font-semibold text-neutral-900 font-sans tracking-tight pt-1">
                        {settings.currencySymbol}{(totalSavingsAgg / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="pt-3">
                      <div className="text-[10px] uppercase text-neutral-400 font-semibold">Total Paid Share Capital Equity (3010)</div>
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
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500 text-[10px] uppercase font-semibold border-b border-neutral-150">
                      <th className="py-2.5 px-4 w-28">Employee ID</th>
                      <th className="py-2.5 px-4">Member Name</th>
                      <th className="py-2.5 px-4">Department</th>
                      <th className="py-2.5 px-4 text-right">Savings Ledger (2010)</th>
                      <th className="py-2.5 px-4 text-right">Share Capital (3010)</th>
                      <th className="py-2.5 px-4 text-right w-40 bg-neutral-50/10">Summary Balances</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-150 bg-white">
                    {filteredMembers.map(m => {
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
          )}

          {/* Active TAB 3: SECURITY TRACES (AUDIT LOGS) */}
          {activeSubTab === 'audit' && (
            <div className="space-y-4">
              <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xl shadow-neutral-200/25 overflow-hidden">
                <div className="p-4 border-b border-neutral-150 bg-neutral-50/50 flex justify-between items-center text-xs">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Security Intrusion Trace logs</span>
                  <div className="text-[10px] text-neutral-400 font-medium">Chronological activities logs</div>
                </div>
                {auditLogsList.length === 0 ? (
                  <div className="py-24 text-center max-w-sm mx-auto flex flex-col items-center gap-2">
                    <History className="w-10 h-10 text-neutral-300" />
                    <h3 className="text-xs font-semibold text-neutral-800">Clear Intrusion Record</h3>
                    <p className="text-[11px] text-neutral-400">No admin-level actions or reversals have occurred yet.</p>
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
                        <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-neutral-50/30 transition-colors text-xs">
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
