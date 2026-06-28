import React, { useState, useEffect } from 'react';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { AppSettings } from '../../types.ts';
import { Plus, Pencil, Trash2, X, Loader } from 'lucide-react';

interface Props { token: string; settings: AppSettings; }

const bpsToDisplay = (bps: number) => (bps / 100).toFixed(2);
const displayToBps = (val: string) => Math.round(parseFloat(val || '0') * 100);
const centsToCurrency = (cents: number) => (cents / 100).toFixed(2);
const currencyToCents = (val: string) => Math.round(parseFloat(val || '0') * 100);

// ─── Savings Products ────────────────────────────────────────────────────────

const emptySavings = { name: '', description: '', interestRate: '0.00', minBalance: '0.00', isActive: true };

function SavingsProducts({ token, settings }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item?: any } | null>(null);
  const [form, setForm] = useState<typeof emptySavings & { isActive: boolean }>(emptySavings);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const sym = settings.currencySymbol;

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/terms/savings-products', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setItems(await safeReadJson(res));
    } finally { setIsLoading(false); }
  };

  const flash = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); };

  const openAdd = () => {
    setForm(emptySavings);
    setModal({ mode: 'add' });
  };

  const openEdit = (item: any) => {
    setForm({
      name: item.name,
      description: item.description || '',
      interestRate: bpsToDisplay(item.interestRateBps),
      minBalance: centsToCurrency(item.minBalanceCents),
      isActive: item.isActive,
    });
    setModal({ mode: 'edit', item });
  };

  const closeModal = () => { setModal(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        interestRateBps: displayToBps(form.interestRate),
        minBalanceCents: currencyToCents(form.minBalance),
        isActive: form.isActive,
      };
      if (modal?.mode === 'add') {
        const res = await fetch('/api/terms/savings-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await safeReadJson(res)).error);
        flash('success', 'Savings product added.');
      } else {
        const res = await fetch(`/api/terms/savings-products/${modal!.item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await safeReadJson(res)).error);
        flash('success', 'Updated.');
      }
      closeModal();
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete savings product "${name}"?`)) return;
    try {
      const res = await fetch(`/api/terms/savings-products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      flash('success', 'Deleted.');
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-700">Savings Products</h3>
          <p className="text-[11px] text-neutral-400 mt-0.5">Savings account types offered to members (e.g. Regular Savings, Time Deposit).</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-1.5 px-3 rounded-lg cursor-pointer transition-colors">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {msg && <div className={`flex items-center justify-between gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${msg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}><span>{msg.text}</span><button type="button" onClick={() => setMsg(null)} className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none cursor-pointer">×</button></div>}

      {isLoading ? (
        <div className="py-4 flex justify-center"><Loader className="w-4 h-4 animate-spin text-neutral-400" /></div>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-400 py-4 text-center">No savings products defined yet.</p>
      ) : (
        <div className="border border-neutral-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-400 uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3 text-left font-semibold">Product</th>
                <th className="py-2 px-3 text-right font-semibold">Annual Rate</th>
                <th className="py-2 px-3 text-right font-semibold">Min Balance</th>
                <th className="py-2 px-3 text-center font-semibold w-20">Active</th>
                <th className="py-2 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-neutral-50/50">
                  <td className="py-2 px-3">
                    <div className="font-medium text-neutral-800">{item.name}</div>
                    {item.description && <div className="text-[10px] text-neutral-400">{item.description}</div>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{bpsToDisplay(item.interestRateBps)}%</td>
                  <td className="py-2 px-3 text-right font-mono">{sym}{centsToCurrency(item.minBalanceCents)}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openEdit(item)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(item.id, item.name)} className="text-neutral-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h2 className="text-sm font-bold text-neutral-800">
                {modal.mode === 'add' ? 'Add Savings Product' : 'Edit Savings Product'}
              </h2>
              <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Product Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
                    className="w-full text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Annual Interest Rate (%)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">%</span>
                    <input type="number" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} min="0" step="0.01"
                      className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-10 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">p.a.</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Minimum Balance (optional)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">{sym}</span>
                    <input type="number" value={form.minBalance} onChange={e => setForm(f => ({ ...f, minBalance: e.target.value }))} min="0" step="0.01"
                      className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
              <button onClick={closeModal}
                className="text-xs font-semibold border border-neutral-200 text-neutral-700 py-1.5 px-4 rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving || !form.name.trim()}
                className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 text-white py-1.5 px-4 rounded-lg cursor-pointer disabled:opacity-50 hover:bg-neutral-800 transition-colors">
                {isSaving && <Loader className="w-3 h-3 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loan Products ───────────────────────────────────────────────────────────

const emptyLoan = { name: '', description: '', interestRate: '1.00', maxTermMonths: '12', minAmount: '0.00', maxAmount: '0.00', isActive: true };

function LoanProducts({ token, settings }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item?: any } | null>(null);
  const [form, setForm] = useState<typeof emptyLoan & { isActive: boolean }>(emptyLoan);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const sym = settings.currencySymbol;

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/terms/loan-products', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setItems(await safeReadJson(res));
    } finally { setIsLoading(false); }
  };

  const flash = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); };

  const toPayload = (f: typeof emptyLoan & { isActive: boolean }) => ({
    name: f.name.trim(),
    description: f.description || null,
    interestRateBps: displayToBps(f.interestRate),
    maxTermMonths: parseInt(f.maxTermMonths || '12'),
    minAmountCents: currencyToCents(f.minAmount),
    maxAmountCents: currencyToCents(f.maxAmount),
    isActive: f.isActive,
  });

  const openAdd = () => {
    setForm(emptyLoan);
    setModal({ mode: 'add' });
  };

  const openEdit = (item: any) => {
    setForm({
      name: item.name,
      description: item.description || '',
      interestRate: bpsToDisplay(item.interestRateBps),
      maxTermMonths: String(item.maxTermMonths),
      minAmount: centsToCurrency(item.minAmountCents),
      maxAmount: centsToCurrency(item.maxAmountCents),
      isActive: item.isActive,
    });
    setModal({ mode: 'edit', item });
  };

  const closeModal = () => { setModal(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      if (modal?.mode === 'add') {
        const res = await fetch('/api/terms/loan-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(toPayload(form)),
        });
        if (!res.ok) throw new Error((await safeReadJson(res)).error);
        flash('success', 'Loan product added.');
      } else {
        const res = await fetch(`/api/terms/loan-products/${modal!.item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(toPayload(form)),
        });
        if (!res.ok) throw new Error((await safeReadJson(res)).error);
        flash('success', 'Updated.');
      }
      closeModal();
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete loan product "${name}"?`)) return;
    try {
      const res = await fetch(`/api/terms/loan-products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      flash('success', 'Deleted.');
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
  };

  const AddRow = ({ f, setF }: { f: typeof emptyLoan & { isActive: boolean }; setF: React.Dispatch<React.SetStateAction<typeof emptyLoan & { isActive: boolean }>> }) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Product Name *</label>
          <input value={f.name} onChange={e => setF(prev => ({ ...prev, name: e.target.value }))} autoFocus
            className="w-full text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Description</label>
          <input value={f.description} onChange={e => setF(prev => ({ ...prev, description: e.target.value }))}
            className="w-full text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Monthly Interest Rate (%)</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">%</span>
            <input type="number" value={f.interestRate} onChange={e => setF(prev => ({ ...prev, interestRate: e.target.value }))} min="0" step="0.01"
              className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-10 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">/mo</span>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Max Term (months)</label>
          <input type="number" value={f.maxTermMonths} onChange={e => setF(prev => ({ ...prev, maxTermMonths: e.target.value }))} min="1" step="1" placeholder="e.g. 24"
            className="w-full text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Min Amount</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">{sym}</span>
            <input type="number" value={f.minAmount} onChange={e => setF(prev => ({ ...prev, minAmount: e.target.value }))} min="0" step="0.01" placeholder="Minimum loan amount"
              className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Max Amount</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">{sym}</span>
            <input type="number" value={f.maxAmount} onChange={e => setF(prev => ({ ...prev, maxAmount: e.target.value }))} min="0" step="0.01" placeholder="Maximum loan amount"
              className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
        <input type="checkbox" checked={f.isActive} onChange={e => setF(prev => ({ ...prev, isActive: e.target.checked }))} />
        Active
      </label>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-700">Loan Products</h3>
          <p className="text-[11px] text-neutral-400 mt-0.5">Types of loans available to members (e.g. Emergency Loan, Multi-Purpose Loan).</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-1.5 px-3 rounded-lg cursor-pointer transition-colors">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {msg && <div className={`flex items-center justify-between gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${msg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}><span>{msg.text}</span><button type="button" onClick={() => setMsg(null)} className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none cursor-pointer">×</button></div>}

      {isLoading ? (
        <div className="py-4 flex justify-center"><Loader className="w-4 h-4 animate-spin text-neutral-400" /></div>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-400 py-4 text-center">No loan products defined yet.</p>
      ) : (
        <div className="border border-neutral-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-400 uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3 text-left font-semibold">Product</th>
                <th className="py-2 px-3 text-right font-semibold">Monthly Rate</th>
                <th className="py-2 px-3 text-right font-semibold">Maximum Duration</th>
                <th className="py-2 px-3 text-right font-semibold">Loan Amount Range</th>
                <th className="py-2 px-3 text-center font-semibold w-20">Active</th>
                <th className="py-2 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-neutral-50/50">
                  <td className="py-2 px-3">
                    <div className="font-medium text-neutral-800">{item.name}</div>
                    {item.description && <div className="text-[10px] text-neutral-400">{item.description}</div>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{bpsToDisplay(item.interestRateBps)}%</td>
                  <td className="py-2 px-3 text-right font-mono">{item.maxTermMonths} mos</td>
                  <td className="py-2 px-3 text-right font-mono text-neutral-600">
                    {sym}{centsToCurrency(item.minAmountCents)} – {sym}{centsToCurrency(item.maxAmountCents)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openEdit(item)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(item.id, item.name)} className="text-neutral-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h2 className="text-sm font-bold text-neutral-800">
                {modal.mode === 'add' ? 'Add Loan Product' : 'Edit Loan Product'}
              </h2>
              <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4">
              <AddRow f={form} setF={setForm} />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
              <button onClick={closeModal}
                className="text-xs font-semibold border border-neutral-200 text-neutral-700 py-1.5 px-4 rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving || !form.name.trim()}
                className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 text-white py-1.5 px-4 rounded-lg cursor-pointer disabled:opacity-50 hover:bg-neutral-800 transition-colors">
                {isSaving && <Loader className="w-3 h-3 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsProducts({ token, settings }: Props) {
  return (
    <div className="space-y-8">
      <SavingsProducts token={token} settings={settings} />
      <div className="border-t border-neutral-100" />
      <LoanProducts token={token} settings={settings} />
    </div>
  );
}
