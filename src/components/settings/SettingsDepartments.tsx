import React, { useState, useEffect } from 'react';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { Plus, Pencil, Trash2, Loader, X } from 'lucide-react';
import InfoButton from '../InfoButton.tsx';

interface Props { token: string; }

interface Dept {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

type Modal = { mode: 'add' } | { mode: 'edit'; item: Dept };

export default function SettingsDepartments({ token }: Props) {
  const [items, setItems] = useState<Dept[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<Modal | null>(null);
  const [form, setForm] = useState({ name: '', code: '', isActive: true });
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/terms/departments', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setItems(await safeReadJson(res));
    } finally { setIsLoading(false); }
  };

  const flash = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); };

  const openAdd = () => {
    setForm({ name: '', code: '', isActive: true });
    setModal({ mode: 'add' });
  };

  const openEdit = (item: Dept) => {
    setForm({ name: item.name, code: item.code, isActive: item.isActive });
    setModal({ mode: 'edit', item });
  };

  const closeModal = () => setModal(null);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/terms/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      closeModal();
      flash('success', 'Department added.');
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleUpdate = async (id: number) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/terms/departments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      closeModal();
      flash('success', 'Updated.');
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete department "${name}"?`)) return;
    try {
      const res = await fetch(`/api/terms/departments/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      flash('success', 'Deleted.');
      await fetchItems();
    } catch (err: any) { flash('error', err.message); }
  };

  const handleSave = () => {
    if (!modal) return;
    if (modal.mode === 'add') handleAdd();
    else handleUpdate(modal.item.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Company Departments</h2>
            <InfoButton text="Define the departments or work units in your organization. Members are assigned to a department when they join. You can add, rename, or deactivate departments at any time." />
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Departments used for member classification. The code appears as a shorthand (e.g. HR, FIN, OPS).</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-1.5 px-3 rounded-lg cursor-pointer transition-colors">
          <Plus className="w-3 h-3" /> Add
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
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-400 py-4 text-center">No departments yet.</p>
      ) : (
        <div className="border border-neutral-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-400 uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3 text-left font-semibold">Department</th>
                <th className="py-2 px-3 text-left font-semibold w-24">Code</th>
                <th className="py-2 px-3 text-center font-semibold w-20">Status</th>
                <th className="py-2 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-neutral-50/50">
                  <td className="py-2 px-3 font-medium text-neutral-800">{item.name}</td>
                  <td className="py-2 px-3 font-mono text-neutral-600">{item.code}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openEdit(item)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(item.id, item.name)} className="text-neutral-300 hover:text-red-500 cursor-pointer">
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

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-800">
                {modal.mode === 'add' ? 'Add Department' : 'Edit Department'}
              </h3>
              <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Name <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                  placeholder="e.g. Human Resources"
                  className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Code <span className="text-red-500">*</span></label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  maxLength={10}
                  placeholder="e.g. HR"
                  className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono uppercase"
                />
              </div>
              {modal.mode === 'edit' && (
                <div className="flex items-center gap-2">
                  <input
                    id="dept-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="rounded border-neutral-300 cursor-pointer"
                  />
                  <label htmlFor="dept-active" className="text-xs font-medium text-neutral-600 cursor-pointer">Active</label>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
              <button
                onClick={closeModal}
                className="text-xs font-semibold border border-neutral-200 text-neutral-600 hover:bg-neutral-50 py-1.5 px-4 rounded-lg cursor-pointer transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.name.trim() || !form.code.trim()}
                className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-1.5 px-4 rounded-lg cursor-pointer transition-colors disabled:opacity-50">
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
