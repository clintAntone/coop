import React, { useState, useEffect } from 'react';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { Plus, Pencil, Trash2, Check, X, Loader } from 'lucide-react';

interface Props { token: string; }

const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const TYPE_COLORS: Record<string, string> = {
  asset: 'bg-blue-50 text-blue-700',
  liability: 'bg-amber-50 text-amber-700',
  equity: 'bg-emerald-50 text-emerald-700',
  revenue: 'bg-purple-50 text-purple-700',
  expense: 'bg-red-50 text-red-700',
};

export default function SettingsChartOfAccounts({ token }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const emptyAdd = { code: '', name: '', type: 'asset', normalBalance: 'debit', description: '' };
  const [addForm, setAddForm] = useState(emptyAdd);
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

  const handleAdd = async () => {
    if (!addForm.code.trim() || !addForm.name.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setAddForm(emptyAdd);
      setShowAdd(false);
      flash('success', `COA ${addForm.code} added.`);
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleUpdate = async (code: string) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/coa/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editForm.name, type: editForm.type, normalBalance: editForm.normalBalance, description: editForm.description }),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setEditingCode(null);
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

  const FormRow = ({ form, setForm }: { form: typeof emptyAdd; setForm: any }) => (
    <div className="grid grid-cols-5 gap-2">
      <input value={form.code} onChange={e => setForm((f: any) => ({ ...f, code: e.target.value }))} placeholder="Code *" maxLength={10}
        className="text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-400" />
      <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Account name *"
        className="col-span-2 text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
      <select value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value, normalBalance: ['asset', 'expense'].includes(e.target.value) ? 'debit' : 'credit' }))}
        className="text-xs border border-neutral-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white capitalize">
        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={form.normalBalance} onChange={e => setForm((f: any) => ({ ...f, normalBalance: e.target.value }))}
        className="text-xs border border-neutral-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white capitalize">
        <option value="debit">Debit</option>
        <option value="credit">Credit</option>
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Chart of Accounts</h2>
          <p className="text-[11px] text-neutral-400 mt-1">Manage account codes used in double-entry journal postings.</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-1.5 px-3 rounded-lg cursor-pointer transition-colors">
          <Plus className="w-3 h-3" /> Add Account
        </button>
      </div>

      {msg && <div className={`flex items-center justify-between gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${msg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}><span>{msg.text}</span><button type="button" onClick={() => setMsg(null)} className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none cursor-pointer">×</button></div>}

      {showAdd && (
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-2">
          <FormRow form={addForm} setForm={setAddForm} />
          <input value={addForm.description} onChange={e => setAddForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Description (optional)"
            className="w-full text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
          <div className="flex items-center gap-2">
            <button onClick={handleAdd} disabled={isSaving || !addForm.code.trim() || !addForm.name.trim()}
              className="flex items-center gap-1 text-xs font-semibold bg-neutral-900 text-white py-1.5 px-3 rounded-md cursor-pointer disabled:opacity-50">
              {isSaving ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
            </button>
            <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
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
                <th className="py-2 px-3 text-center font-semibold w-20">Normal Bal.</th>
                <th className="py-2 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(item => (
                <tr key={item.code} className="hover:bg-neutral-50/50">
                  {editingCode === item.code ? (
                    <>
                      <td className="py-2 px-3 font-mono text-neutral-500">{item.code}</td>
                      <td colSpan={3} className="py-2 px-3 space-y-1.5">
                        <div className="grid grid-cols-4 gap-2">
                          <input value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                            className="col-span-2 text-xs border border-neutral-300 rounded px-2 py-1 focus:outline-none" />
                          <select value={editForm.type} onChange={e => setEditForm((f: any) => ({ ...f, type: e.target.value }))}
                            className="text-xs border border-neutral-300 rounded px-2 py-1 bg-white capitalize focus:outline-none">
                            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select value={editForm.normalBalance} onChange={e => setEditForm((f: any) => ({ ...f, normalBalance: e.target.value }))}
                            className="text-xs border border-neutral-300 rounded px-2 py-1 bg-white capitalize focus:outline-none">
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                          </select>
                        </div>
                        <input value={editForm.description || ''} onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Description"
                          className="w-full text-xs border border-neutral-300 rounded px-2 py-1 focus:outline-none" />
                      </td>
                      <td className="py-2 px-3 align-top pt-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => handleUpdate(item.code)} disabled={isSaving} className="text-emerald-600 cursor-pointer">
                            {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setEditingCode(null)} className="text-neutral-400 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
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
                      <td className="py-2 px-3 text-center capitalize text-neutral-500">{item.normalBalance}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => { setEditingCode(item.code); setEditForm({ name: item.name, type: item.type, normalBalance: item.normalBalance, description: item.description || '' }); }}
                            className="text-neutral-400 hover:text-neutral-700 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(item.code, item.name)} className="text-neutral-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
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
