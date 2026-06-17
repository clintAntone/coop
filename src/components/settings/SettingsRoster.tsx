import React, { useState, useEffect, useRef } from 'react';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { Upload, Trash2, Loader, FileText } from 'lucide-react';

interface Props {
  token: string;
}

export default function SettingsRoster({ token }: Props) {
  const [employeeIds, setEmployeeIds] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchRoster(); }, []);

  const fetchRoster = async () => {
    const res = await fetch('/api/settings/employee-ids', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setEmployeeIds(await safeReadJson(res));
  };

  const handleRosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setMsg(null);
    try {
      const text = await file.text();
      const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) throw new Error('CSV file is empty.');

      const parseRow = (line: string) => {
        const fields: string[] = [];
        let current = '';
        let inQuote = false;
        for (const ch of line) {
          if (ch === '"') { inQuote = !inQuote; continue; }
          if (ch === ',' && !inQuote) { fields.push(current.trim()); current = ''; continue; }
          current += ch;
        }
        fields.push(current.trim());
        return fields;
      };

      let startIdx = 0;
      const firstCell = parseRow(lines[0])[0].toLowerCase();
      if (['employeeid', 'employee_id', 'id', 'emp_id'].includes(firstCell)) startIdx = 1;

      const employees = lines.slice(startIdx).map(line => {
        const [empId = '', firstName = '', middleName = '', lastName = ''] = parseRow(line);
        return { employeeId: empId, firstName, middleName, lastName };
      }).filter(e => e.employeeId);

      if (employees.length === 0) throw new Error('No valid employee records found in CSV.');

      const res = await fetch('/api/settings/employee-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employees }),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      const data = await safeReadJson(res);
      setMsg({ type: 'success', text: `Roster uploaded: ${data.inserted} employee record(s) added.` });
      await fetchRoster();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearRoster = async () => {
    if (!window.confirm('Clear the entire employee roster? New users will not be able to register until a new roster is uploaded.')) return;
    setIsClearing(true);
    try {
      const res = await fetch('/api/settings/employee-ids', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setEmployeeIds([]);
      setMsg({ type: 'success', text: 'Employee roster cleared.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Employee Roster</h2>
      <p className="text-xs text-neutral-500">Upload your employee list as a CSV. When non-empty, new users must provide a valid employee ID to register.</p>

      <div className="flex items-start gap-2.5 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
        <FileText className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-neutral-600 mb-0.5">Expected CSV format</p>
          <p className="text-[11px] font-mono text-neutral-500">employeeId, firstName, middleName, lastName</p>
          <p className="text-[10px] text-neutral-400 mt-1">Header row is auto-detected and skipped. Middle name may be left blank.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleRosterUpload} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
          className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
          {isUploading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {isUploading ? 'Uploading...' : 'Upload Roster CSV'}
        </button>
        {employeeIds.length > 0 && (
          <button onClick={handleClearRoster} disabled={isClearing}
            className="flex items-center gap-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold py-2 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
            {isClearing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Clear Roster
          </button>
        )}
      </div>

      {msg && <p className={`text-xs font-medium ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}

      <p className="text-xs text-neutral-500">
        {employeeIds.length === 0
          ? 'No roster uploaded. Registration verification is disabled.'
          : `${employeeIds.length} employee(s) in roster. ${employeeIds.filter(e => e.isClaimed).length} claimed.`}
      </p>

      {employeeIds.length > 0 && (
        <div className="max-h-64 overflow-y-auto border border-neutral-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-400 uppercase text-[10px] sticky top-0">
              <tr>
                <th className="py-2 px-3 text-left font-semibold">Employee ID</th>
                <th className="py-2 px-3 text-left font-semibold">Name</th>
                <th className="py-2 px-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {employeeIds.map(e => {
                const fullName = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || '—';
                return (
                  <tr key={e.id}>
                    <td className="py-2 px-3 font-mono">{e.employeeId}</td>
                    <td className="py-2 px-3 text-neutral-700">{fullName}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${e.isClaimed ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {e.isClaimed ? 'Claimed' : 'Available'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
