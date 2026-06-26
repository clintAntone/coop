import React, { useState, useEffect } from 'react';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { Plus, Pencil, Trash2, Check, X, Loader } from 'lucide-react';

interface Props { token: string; }

interface Dept {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsDepartments({ token }: Props) {
  const [items, setItems] = useState<Dept[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Dept>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', code: '', isActive: true });
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

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.code.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/terms/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setAddForm({ name: '', code: '', isActive: true });
      setShowAdd(false);
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
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setEditingId(null);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Company Departments</h2>
          <p className="text-[11px] text-neutral-400 mt-1">Departments used for member classification. The code appears as a shorthand (e.g. HR, FIN, OPS).</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white py-1.5 px-3 rounded-lg cursor-pointer transition-colors">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {msg && <div className={`flex items-center justify-between gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${msg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}><span>{msg.text}</span><button type="button" onClick={() => setMsg(null)} className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none cursor-pointer">×</button></div>}

      {showAdd && (
        <div className="flex items-center gap-2 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Department name *" autoFocus
            className="flex-grow text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
          <input value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="Code (e.g. HR)" maxLength={10}
            className="w-24 text-xs border border-neutral-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-mono uppercase" />
          <button onClick={handleAdd} disabled={isSaving || !addForm.name.trim() || !addForm.code.trim()}
            className="flex items-center gap-1 text-xs font-semibold bg-neutral-900 text-white py-1.5 px-3 rounded-md cursor-pointer disabled:opacity-50">
            {isSaving ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
          </button>
          <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
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
                  {editingId === item.id ? (
                    <>
                      <td className="py-2 px-3">
                        <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full text-xs border border-neutral-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                      </td>
                      <td className="py-2 px-3">
                        <input value={editForm.code || ''} onChange={e => setEditForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                          className="w-full text-xs border border-neutral-300 rounded px-2 py-1 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-neutral-400" />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input type="checkbox" checked={editForm.isActive ?? true} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => handleUpdate(item.id)} disabled={isSaving} className="text-emerald-600 hover:text-emerald-700 cursor-pointer">
                            {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 font-medium text-neutral-800">{item.name}</td>
                      <td className="py-2 px-3 font-mono text-neutral-600">{item.code}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, code: item.code, isActive: item.isActive }); }}
                            className="text-neutral-400 hover:text-neutral-700 cursor-pointer">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(item.id, item.name)} className="text-neutral-300 hover:text-red-500 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
