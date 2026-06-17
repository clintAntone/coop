import React, { useState, useEffect } from 'react';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { AppSettings } from '../../types.ts';
import { Plus, Pencil, Trash2, Check, X, Loader } from 'lucide-react';

interface Props { token: string; settings: AppSettings; }

const bpsToDisplay = (bps: number) => (bps / 100).toFixed(2);
const displayToBps = (val: string) => Math.round(parseFloat(val || '0') * 100);
const centsToCurrency = (cents: number) => (cents / 100).toFixed(2);
const currencyToCents = (val: string) => Math.round(parseFloat(val || '0') * 100);

// ─── Savings Products ────────────────────────────────────────────────────────

function SavingsProducts({ token, settings }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '', interestRate: '0.00', minBalance: '0.00', isActive: true });
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

  const flash = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000); };

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/terms/savings-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: addForm.name.trim(),
          description: addForm.description || null,
          interestRateBps: displayToBps(addForm.interestRate),
          minBalanceCents: currencyToCents(addForm.minBalance),
          isActive: addForm.isActive,
        }),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setAddForm({ name: '', description: '', interestRate: '0.00', minBalance: '0.00', isActive: true });
      setShowAdd(false);
      flash('success', 'Savings product added.');
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleUpdate = async (id: number) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/terms/savings-products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          interestRateBps: displayToBps(editForm.interestRate),
          minBalanceCents: currencyToCents(editForm.minBalance),
          isActive: editForm.isActive,
        }),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setEditingId(null);
      flash('success', 'Updated.');
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

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, description: item.description || '', interestRate: bpsToDisplay(item.interestRateBps), minBalance: centsToCurrency(item.minBalanceCents), isActive: item.isActive });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-700">Savings Products</h3>
          <p className="text-[11px] text-neutral-400 mt-0.5">Savings account types offered to members (e.g. Regular Savings, Time Deposit).</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-1.5 px-3 rounded-lg cursor-pointer transition-colors">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {msg && <p className={`text-xs font-medium ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}

      {showAdd && (
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name *" autoFocus
              className="text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
            <input value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
              className="text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">%</span>
              <input type="number" value={addForm.interestRate} onChange={e => setAddForm(f => ({ ...f, interestRate: e.target.value }))} placeholder="0.00" min="0" step="0.01"
                className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">p.a.</span>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">{sym}</span>
              <input type="number" value={addForm.minBalance} onChange={e => setAddForm(f => ({ ...f, minBalance: e.target.value }))} placeholder="Min balance" min="0" step="0.01"
                className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
              <input type="checkbox" checked={addForm.isActive} onChange={e => setAddForm(f => ({ ...f, isActive: e.target.checked }))} /> Active
            </label>
            <button onClick={handleAdd} disabled={isSaving || !addForm.name.trim()}
              className="flex items-center gap-1 text-xs font-semibold bg-neutral-900 text-white py-1.5 px-3 rounded-md cursor-pointer disabled:opacity-50">
              {isSaving ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
            </button>
            <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

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
                <th className="py-2 px-3 text-right font-semibold">Rate (p.a.)</th>
                <th className="py-2 px-3 text-right font-semibold">Min Balance</th>
                <th className="py-2 px-3 text-center font-semibold w-20">Active</th>
                <th className="py-2 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-neutral-50/50">
                  {editingId === item.id ? (
                    <>
                      <td className="py-2 px-3">
                        <input value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                          className="w-full text-xs border border-neutral-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                      </td>
                      <td className="py-2 px-3">
                        <input type="number" value={editForm.interestRate} onChange={e => setEditForm((f: any) => ({ ...f, interestRate: e.target.value }))} min="0" step="0.01"
                          className="w-full text-xs border border-neutral-300 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                      </td>
                      <td className="py-2 px-3">
                        <input type="number" value={editForm.minBalance} onChange={e => setEditForm((f: any) => ({ ...f, minBalance: e.target.value }))} min="0" step="0.01"
                          className="w-full text-xs border border-neutral-300 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm((f: any) => ({ ...f, isActive: e.target.checked }))} />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => handleUpdate(item.id)} disabled={isSaving} className="text-emerald-600 hover:text-emerald-700 cursor-pointer">
                            {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
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
                          <button onClick={() => startEdit(item)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(item.id, item.name)} className="text-neutral-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Loan Products ───────────────────────────────────────────────────────────

function LoanProducts({ token, settings }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const emptyAdd = { name: '', description: '', interestRate: '1.00', maxTermMonths: '12', minAmount: '0.00', maxAmount: '0.00', isActive: true };
  const [addForm, setAddForm] = useState(emptyAdd);
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

  const flash = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000); };

  const toPayload = (f: any) => ({
    name: f.name.trim(),
    description: f.description || null,
    interestRateBps: displayToBps(f.interestRate),
    maxTermMonths: parseInt(f.maxTermMonths || '12'),
    minAmountCents: currencyToCents(f.minAmount),
    maxAmountCents: currencyToCents(f.maxAmount),
    isActive: f.isActive,
  });

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/terms/loan-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(toPayload(addForm)),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setAddForm(emptyAdd);
      setShowAdd(false);
      flash('success', 'Loan product added.');
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleUpdate = async (id: number) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/terms/loan-products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(toPayload(editForm)),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setEditingId(null);
      flash('success', 'Updated.');
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

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name, description: item.description || '',
      interestRate: bpsToDisplay(item.interestRateBps),
      maxTermMonths: String(item.maxTermMonths),
      minAmount: centsToCurrency(item.minAmountCents),
      maxAmount: centsToCurrency(item.maxAmountCents),
      isActive: item.isActive,
    });
  };

  const AddRow = ({ form, setForm }: { form: typeof emptyAdd; setForm: any }) => (
    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Product name *"
          className="text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
        <input value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Description"
          className="text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">%</span>
          <input type="number" value={form.interestRate} onChange={e => setForm((f: any) => ({ ...f, interestRate: e.target.value }))} min="0" step="0.01"
            className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">/mo</span>
        </div>
        <input type="number" value={form.maxTermMonths} onChange={e => setForm((f: any) => ({ ...f, maxTermMonths: e.target.value }))} min="1" step="1" placeholder="Max months"
          className="text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">{sym}</span>
          <input type="number" value={form.minAmount} onChange={e => setForm((f: any) => ({ ...f, minAmount: e.target.value }))} min="0" step="0.01"
            className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" placeholder="Min amount" />
        </div>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">{sym}</span>
          <input type="number" value={form.maxAmount} onChange={e => setForm((f: any) => ({ ...f, maxAmount: e.target.value }))} min="0" step="0.01"
            className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" placeholder="Max amount" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm((f: any) => ({ ...f, isActive: e.target.checked }))} /> Active
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-neutral-700">Loan Products</h3>
          <p className="text-[11px] text-neutral-400 mt-0.5">Types of loans available to members (e.g. Emergency Loan, Multi-Purpose Loan).</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-1.5 px-3 rounded-lg cursor-pointer transition-colors">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {msg && <p className={`text-xs font-medium ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}

      {showAdd && (
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-2">
          <AddRow form={addForm} setForm={setAddForm} />
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleAdd} disabled={isSaving || !addForm.name.trim()}
              className="flex items-center gap-1 text-xs font-semibold bg-neutral-900 text-white py-1.5 px-3 rounded-md cursor-pointer disabled:opacity-50">
              {isSaving ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
            </button>
            <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

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
                <th className="py-2 px-3 text-right font-semibold">Rate/mo</th>
                <th className="py-2 px-3 text-right font-semibold">Max Term</th>
                <th className="py-2 px-3 text-right font-semibold">Min–Max Amount</th>
                <th className="py-2 px-3 text-center font-semibold w-20">Active</th>
                <th className="py-2 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-neutral-50/50">
                  {editingId === item.id ? (
                    <>
                      <td colSpan={5} className="py-2 px-3">
                        <AddRow form={editForm} setForm={setEditForm} />
                      </td>
                      <td className="py-2 px-3 align-top pt-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => handleUpdate(item.id)} disabled={isSaving} className="text-emerald-600 cursor-pointer">
                            {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-neutral-400 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
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
                          <button onClick={() => startEdit(item)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(item.id, item.name)} className="text-neutral-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
