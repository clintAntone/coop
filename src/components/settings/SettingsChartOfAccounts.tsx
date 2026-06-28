import React, { useState, useEffect } from 'react';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { Plus, Pencil, Trash2, X, Loader } from 'lucide-react';

interface Props { token: string; }

const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const TYPE_COLORS: Record<string, string> = {
  asset: 'bg-blue-50 text-blue-700',
  liability: 'bg-amber-50 text-amber-700',
  equity: 'bg-emerald-50 text-emerald-700',
  revenue: 'bg-purple-50 text-purple-700',
  expense: 'bg-red-50 text-red-700',
};

const emptyForm = { code: '', name: '', type: 'asset', normalBalance: 'debit', description: '' };

export default function SettingsChartOfAccounts({ token }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item?: any } | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/coa', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setItems(await safeReadJson(res));
    } finally { setIsLoading(false); }
  };

  const flash = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); };

  const openAdd = () => {
    setForm(emptyForm);
    setModal({ mode: 'add' });
  };

  const openEdit = (item: any) => {
    setForm({ code: item.code, name: item.name, type: item.type, normalBalance: item.normalBalance, description: item.description || '' });
    setModal({ mode: 'edit', item });
  };

  const closeModal = () => setModal(null);

  const handleTypeChange = (type: string) => {
    setForm(f => ({ ...f, type, normalBalance: ['asset', 'expense'].includes(type) ? 'debit' : 'credit' }));
  };

  const handleAdd = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      closeModal();
      flash('success', `COA ${form.code} added.`);
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleUpdate = async () => {
    if (!modal?.item) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/coa/${modal.item.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, type: form.type, normalBalance: form.normalBalance, description: form.description }),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      closeModal();
      flash('success', 'Updated.');
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (code: string, name: string) => {
    if (!confirm(`Delete account "${code} – ${name}"? This will fail if the account has any journal entries.`)) return;
    try {
      const res = await fetch(`/api/coa/${code}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      flash('success', `COA ${code} deleted.`);
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
  };

  const FormRow = () => (
    <div className="space-y-3">
      {modal?.mode === 'add' ? (
        <div>
          <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Code *</label>
          <input
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            placeholder="e.g. 1010"
            maxLength={10}
            className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-400"
          />
        </div>
      ) : (
        <div>
          <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Code</label>
          <div className="text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-600">
            {modal?.item?.code}
          </div>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Account Name *</label>
        <input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Account name"
          className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Type</label>
        <select
          value={form.type}
          onChange={e => handleTypeChange(e.target.value)}
          className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
        >
          <option value="asset">Asset — Things the coop owns</option>
          <option value="liability">Liability — What the coop owes members</option>
          <option value="equity">Equity — Member ownership &amp; retained funds</option>
          <option value="revenue">Revenue — Income earned by the coop</option>
          <option value="expense">Expense — Costs paid by the coop</option>
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Description <span className="normal-case font-normal">(optional)</span></label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Brief description of this account..."
          rows={2}
          className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400 placeholder:text-neutral-400 resize-none"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Account Categories</h2>
          <p className="text-[11px] text-neutral-400 mt-1">Manage the categories used to classify all financial transactions.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-1.5 px-3 rounded-lg cursor-pointer transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Account
        </button>
      </div>

      {msg && (
        <div className={`flex items-center justify-between gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${msg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg(null)} className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none cursor-pointer">×</button>
        </div>
      )}

      {isLoading ? (
        <div className="py-6 flex justify-center"><Loader className="w-4 h-4 animate-spin text-neutral-400" /></div>
      ) : (
        <div className="border border-neutral-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-400 uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3 text-left font-semibold w-20">Code</th>
                <th className="py-2 px-3 text-left font-semibold">Account Name</th>
                <th className="py-2 px-3 text-center font-semibold w-24">Type</th>
                <th className="py-2 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(item => (
                <tr key={item.code} className="hover:bg-neutral-50/50">
                  <td className="py-2 px-3 font-mono font-semibold text-neutral-700">{item.code}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium text-neutral-800">{item.name}</div>
                    {item.description && <div className="text-[10px] text-neutral-400">{item.description}</div>}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${TYPE_COLORS[item.type] || 'bg-neutral-100 text-neutral-500'}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => openEdit(item)}
                        className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.code, item.name)}
                        className="text-neutral-300 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-900">
                {modal.mode === 'add' ? 'Add Account' : `Edit Account`}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-4">
              <FormRow />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-neutral-100 flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={modal.mode === 'add' ? handleAdd : handleUpdate}
                disabled={isSaving || !form.name.trim() || (modal.mode === 'add' && !form.code.trim())}
                className="flex-1 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
                {isSaving ? 'Saving...' : modal.mode === 'add' ? 'Add Account' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
