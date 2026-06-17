import React, { useState, useEffect } from 'react';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { AppSettings } from '../../types.ts';
import { Save, Loader } from 'lucide-react';

interface Props { token: string; settings: AppSettings; }

const CUR = (cents: string) => (parseInt(cents || '0') / 100).toFixed(2);
const CENTS = (val: string) => Math.round(parseFloat(val || '0') * 100);

export default function SettingsShareCapital({ token, settings }: Props) {
  const [parValue, setParValue] = useState('');       // display in currency units
  const [minShares, setMinShares] = useState('');
  const [maxShares, setMaxShares] = useState('');
  const [minMonthly, setMinMonthly] = useState('');   // display in currency units
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchParams(); }, []);

  const fetchParams = async () => {
    const res = await fetch('/api/terms/parameters', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await safeReadJson(res);
      setParValue(CUR(data.share_par_value_cents));
      setMinShares(data.share_min_shares || '');
      setMaxShares(data.share_max_shares || '');
      setMinMonthly(CUR(data.share_min_monthly_contrib_cents));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/terms/parameters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          share_par_value_cents: String(CENTS(parValue)),
          share_min_shares: minShares,
          share_max_shares: maxShares,
          share_min_monthly_contrib_cents: String(CENTS(minMonthly)),
        }),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setMsg({ type: 'success', text: 'Share capital rules saved.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally { setIsSaving(false); }
  };

  const sym = settings.currencySymbol;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Share Capital Rules</h2>
        <p className="text-[11px] text-neutral-400 mt-1">Configure the par value per share and contribution requirements for cooperative membership.</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Par Value per Share ({sym})</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">{sym}</span>
            <input type="number" min="0" step="0.01" value={parValue} onChange={e => setParValue(e.target.value)}
              className="w-full text-sm border border-neutral-200 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              placeholder="100.00" />
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">The face value of one cooperative share certificate.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Minimum Shares (per member)</label>
            <input type="number" min="1" step="1" value={minShares} onChange={e => setMinShares(e.target.value)}
              className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              placeholder="10" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Maximum Shares (per member)</label>
            <input type="number" min="1" step="1" value={maxShares} onChange={e => setMaxShares(e.target.value)}
              className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              placeholder="1000" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Minimum Monthly Contribution ({sym})</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">{sym}</span>
            <input type="number" min="0" step="0.01" value={minMonthly} onChange={e => setMinMonthly(e.target.value)}
              className="w-full text-sm border border-neutral-200 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              placeholder="500.00" />
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">Required monthly share capital contribution per active member.</p>
        </div>
      </div>

      {parValue && minShares && maxShares && (
        <div className="bg-neutral-50 border border-neutral-100 rounded-lg p-3 text-[11px] text-neutral-600 space-y-1">
          <p className="font-semibold text-neutral-500 uppercase text-[10px] tracking-wider mb-1.5">Summary</p>
          <p>Min subscription: {sym}{(parseInt(minShares || '0') * CENTS(parValue) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({minShares} shares × {sym}{parValue})</p>
          <p>Max subscription: {sym}{(parseInt(maxShares || '0') * CENTS(parValue) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({maxShares} shares × {sym}{parValue})</p>
        </div>
      )}

      {msg && <p className={`text-xs font-medium ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}

      <button onClick={handleSave} disabled={isSaving}
        className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
        {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {isSaving ? 'Saving...' : 'Save Share Capital Rules'}
      </button>
    </div>
  );
}
