import React, { useState, useEffect } from 'react';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { AppSettings } from '../../types.ts';
import { Plus, Pencil, Trash2, X, Loader, Save } from 'lucide-react';
import InfoButton from '../InfoButton.tsx';

interface Props { token: string; settings: AppSettings; }

const centsToCurrency = (cents: number) => (cents / 100).toFixed(2);
const currencyToCents = (val: string) => Math.round(parseFloat(val || '0') * 100);

const ROLES = ['System Admin', 'Manager', 'Accounting Officer', 'Cashier'];

const emptyApproval = { role: ROLES[1], maxAmount: '', loanProductId: '' };

// ─── Approval Matrix ─────────────────────────────────────────────────────────

function ApprovalMatrix({ token, settings }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loanProducts, setLoanProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item?: any } | null>(null);
  const [form, setForm] = useState<typeof emptyApproval>(emptyApproval);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const sym = settings.currencySymbol;

  useEffect(() => {
    fetchItems();
    fetch('/api/terms/loan-products', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setLoanProducts).catch(() => {});
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/terms/loan-approval-matrix', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setItems(await safeReadJson(res));
    } finally { setIsLoading(false); }
  };

  const flash = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); };

  const openAdd = () => {
    setForm(emptyApproval);
    setModal({ mode: 'add' });
  };

  const openEdit = (item: any) => {
    setForm({
      role: item.role,
      maxAmount: centsToCurrency(item.maxAmountCents),
      loanProductId: item.loanProductId ? String(item.loanProductId) : '',
    });
    setModal({ mode: 'edit', item });
  };

  const closeModal = () => { setModal(null); };

  const handleSave = async () => {
    if (!form.maxAmount) return;
    setIsSaving(true);
    try {
      const payload = {
        role: form.role,
        maxAmountCents: currencyToCents(form.maxAmount),
        loanProductId: form.loanProductId ? parseInt(form.loanProductId) : null,
      };
      if (modal?.mode === 'add') {
        const res = await fetch('/api/terms/loan-approval-matrix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await safeReadJson(res)).error);
        flash('success', 'Rule added.');
      } else {
        const res = await fetch(`/api/terms/loan-approval-matrix/${modal!.item.id}`, {
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

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this approval rule?')) return;
    try {
      const res = await fetch(`/api/terms/loan-approval-matrix/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      flash('success', 'Removed.');
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-neutral-700">Loan Approval Matrix</h3>
            <InfoButton text="Defines which staff roles can approve loans and up to what amount. For example, a Cashier might approve small loans while a Manager handles larger ones." />
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">Defines which role can approve loans up to a maximum amount. Optionally scoped to a specific loan product.</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-2 px-4 rounded-lg cursor-pointer transition-colors shrink-0 w-full sm:w-auto">
          <Plus className="w-3 h-3" /> Add Rule
        </button>
      </div>

      {msg && <div className={`flex items-center justify-between gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${msg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}><span>{msg.text}</span><button type="button" onClick={() => setMsg(null)} className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none cursor-pointer">×</button></div>}

      {isLoading ? (
        <div className="py-4 flex justify-center"><Loader className="w-4 h-4 animate-spin text-neutral-400" /></div>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-400 py-4 text-center">No approval rules defined yet.</p>
      ) : (
        <div className="border border-neutral-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-400 uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3 text-left font-semibold">Role</th>
                <th className="py-2 px-3 text-left font-semibold">Loan Product</th>
                <th className="py-2 px-3 text-right font-semibold">Max Approvable</th>
                <th className="py-2 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-neutral-50/50">
                  <td className="py-2 px-3 font-medium text-neutral-800">{item.role}</td>
                  <td className="py-2 px-3 text-neutral-500">{item.loanProductName || <span className="italic">All products</span>}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-neutral-800">{sym}{centsToCurrency(item.maxAmountCents)}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openEdit(item)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-neutral-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
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
                {modal.mode === 'add' ? 'Add Approval Rule' : 'Edit Approval Rule'}
              </h2>
              <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} autoFocus
                  className="w-full text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Max Approvable Amount</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">{sym}</span>
                  <input type="number" value={form.maxAmount} onChange={e => setForm(f => ({ ...f, maxAmount: e.target.value }))} min="0" step="0.01"
                    className="w-full text-xs border border-neutral-200 rounded-md pl-6 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Loan Product (optional)</label>
                <select value={form.loanProductId} onChange={e => setForm(f => ({ ...f, loanProductId: e.target.value }))}
                  className="w-full text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white">
                  <option value="">All loan products</option>
                  {loanProducts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
              <button onClick={closeModal}
                className="text-xs font-semibold border border-neutral-200 text-neutral-700 py-1.5 px-4 rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving || !form.maxAmount}
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

// ─── Cooperative Parameters ──────────────────────────────────────────────────

function CoopParameters({ token }: { token: string }) {
  const [minTenure, setMinTenure] = useState('');
  const [savingsMultiplier, setSavingsMultiplier] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/terms/parameters', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => {
        setMinTenure(data.loan_min_tenure_months || '');
        setSavingsMultiplier(data.loan_savings_multiplier || '');
      }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/terms/parameters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ loan_min_tenure_months: minTenure, loan_savings_multiplier: savingsMultiplier }),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setMsg({ type: 'success', text: 'Cooperative parameters saved.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-neutral-700">Cooperative Parameters</h3>
          <InfoButton text="Sets eligibility rules for borrowing — how long a member must be active before taking a loan, and the maximum loan amount relative to their savings." />
        </div>
        <p className="text-[11px] text-neutral-400 mt-0.5">Loan eligibility rules applied system-wide.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Minimum Membership Before Loan (months)</label>
          <input type="number" min="0" step="1" value={minTenure} onChange={e => setMinTenure(e.target.value)}
            className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            placeholder="6" />
          <p className="text-[10px] text-neutral-400 mt-1">How many months a member must be active before applying for a loan.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Max Loan = Savings × (multiplier)</label>
          <input type="number" min="1" step="1" value={savingsMultiplier} onChange={e => setSavingsMultiplier(e.target.value)}
            className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            placeholder="3" />
          <p className="text-[10px] text-neutral-400 mt-1">Maximum loanable amount as a multiple of the member's savings balance.</p>
        </div>
      </div>

      {msg && <div className={`flex items-center justify-between gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${msg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}><span>{msg.text}</span><button type="button" onClick={() => setMsg(null)} className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none cursor-pointer">×</button></div>}

      <button onClick={handleSave} disabled={isSaving}
        className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
        {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {isSaving ? 'Saving...' : 'Save Parameters'}
      </button>
    </div>
  );
}

export default function SettingsLoanRules({ token, settings }: Props) {
  return (
    <div className="space-y-8">
      <ApprovalMatrix token={token} settings={settings} />
      <div className="border-t border-neutral-100" />
      <CoopParameters token={token} />
    </div>
  );
}
