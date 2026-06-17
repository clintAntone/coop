import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { User } from '../types.ts';
import { safeReadJson } from '../lib/safe-fetch.ts';
import {
  Search,
  Loader,
  XCircle,
  CheckCircle,
  Clock,
  UserCheck2,
  UserX,
  RefreshCw,
  Upload,
  Trash2,
  FileSpreadsheet,
  Link2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface UsersModuleProps {
  currentUser: User;
  token: string;
}

interface SystemUser {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  employeeIdVerified: boolean;
  pendingEmployeeId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RosterEntry {
  id: number;
  employeeId: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  isClaimed: boolean;
}

export default function UsersModule({ currentUser, token }: UsersModuleProps) {
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  // Roster upload state
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterEntries, setRosterEntries] = useState<RosterEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [rosterMsg, setRosterMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link & Approve modal state
  const [linkModal, setLinkModal] = useState<{ user: SystemUser } | null>(null);
  const [unclaimedEmployees, setUnclaimedEmployees] = useState<RosterEntry[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [linkRole, setLinkRole] = useState('Member');
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const rolesList = ['System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor', 'Member'];

  useEffect(() => {
    fetchUsers();
    fetchRoster();
  }, [token]);

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to retrieve users.'); }
      setSystemUsers(await res.json());
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoster = async () => {
    try {
      const res = await fetch('/api/settings/employee-ids', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setRosterEntries(await safeReadJson(res));
    } catch {}
  };

  const fetchUnclaimed = async () => {
    try {
      const res = await fetch('/api/settings/unclaimed-employees', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUnclaimedEmployees(await safeReadJson(res));
    } catch {}
  };

  const handleRosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setRosterMsg(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rows.length === 0) throw new Error('Spreadsheet is empty.');

      // Auto-detect header row
      let startIdx = 0;
      const firstCell = String(rows[0][0] || '').toLowerCase().replace(/\s/g, '');
      if (['employeeid', 'employee_id', 'id', 'emp_id', 'empid'].includes(firstCell)) startIdx = 1;

      const employees = rows.slice(startIdx).map(row => ({
        employeeId: String(row[0] || '').trim(),
        firstName: String(row[1] || '').trim(),
        middleName: String(row[2] || '').trim(),
        lastName: String(row[3] || '').trim(),
      })).filter(e => e.employeeId);

      if (employees.length === 0) throw new Error('No valid employee records found in the file.');

      const res = await fetch('/api/settings/employee-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employees }),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      const result = await safeReadJson(res);
      setRosterMsg({ type: 'success', text: `Roster uploaded: ${result.inserted} employee record(s) added.` });
      await fetchRoster();
    } catch (err: any) {
      setRosterMsg({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearRoster = async () => {
    if (!window.confirm('Clear the entire employee roster? This cannot be undone.')) return;
    setIsClearing(true);
    try {
      const res = await fetch('/api/settings/employee-ids', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      setRosterEntries([]);
      setRosterMsg({ type: 'success', text: 'Employee roster cleared.' });
    } catch (err: any) {
      setRosterMsg({ type: 'error', text: err.message });
    } finally {
      setIsClearing(false);
    }
  };

  const openLinkModal = async (user: SystemUser) => {
    setLinkModal({ user });
    setSelectedEmpId('');
    setEmpSearch('');
    setLinkRole('Member');
    setLinkError(null);
    await fetchUnclaimed();
  };

  const handleApproveAndLink = async () => {
    if (!linkModal || !selectedEmpId) return;
    setIsLinking(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/users/${linkModal.user.id}/approve-and-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeeId: selectedEmpId, role: linkRole }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to approve user.'); }
      setLinkModal(null);
      await fetchUsers();
      await fetchRoster();
    } catch (err: any) {
      setLinkError(err.message);
    } finally {
      setIsLinking(false);
    }
  };

  // Quick approve for users who provided their Employee ID at registration
  const handleQuickApprove = async (user: SystemUser) => {
    setUpdatingUserId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}/approve-and-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}), // server uses stored pendingEmployeeId
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to approve user.'); }
      await fetchUsers();
      await fetchRoster();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleUpdateStatus = async (userId: number, currentStatus: boolean) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const u = await res.json();
      setSystemUsers(prev => prev.map(x => x.id === userId ? { ...x, isActive: u.isActive } : x));
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const u = await res.json();
      setSystemUsers(prev => prev.map(x => x.id === userId ? { ...x, role: u.role } : x));
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = systemUsers.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    let matchesStatus = true;
    if (statusFilter === 'pending') matchesStatus = !user.isActive;
    else if (statusFilter === 'active') matchesStatus = user.isActive;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getStatusBadge = (user: SystemUser) => {
    if (!user.isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Pending Approval</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle className="w-3 h-3 shrink-0" />
        <span>Approved & Active</span>
      </span>
    );
  };

  const isAdmin = currentUser.role === 'System Admin';

  return (
    <div className="flex-grow p-8 overflow-y-auto h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-neutral-900">System User Accounts</h1>
          <p className="text-xs text-neutral-400 mt-1">Review registrations, approve members, and manage staff access privileges.</p>
        </div>
        <button onClick={fetchUsers} disabled={isLoading}
          className="flex items-center gap-1.5 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Employee Roster Upload (Admin only) */}
      {isAdmin && (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setRosterOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-neutral-500 shrink-0" />
              <span className="text-sm font-semibold text-neutral-800">Employee Roster</span>
              <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-semibold">
                {rosterEntries.length} records · {rosterEntries.filter(e => e.isClaimed).length} claimed
              </span>
            </div>
            {rosterOpen ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
          </button>

          {rosterOpen && (
            <div className="border-t border-neutral-100 px-5 py-4 space-y-4">
              <div className="flex items-start gap-2.5 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-neutral-600 mb-0.5">Expected Excel format (.xlsx)</p>
                  <p className="text-[11px] font-mono text-neutral-500">Column A: EmployeeID &nbsp;·&nbsp; B: FirstName &nbsp;·&nbsp; C: MiddleName &nbsp;·&nbsp; D: LastName</p>
                  <p className="text-[10px] text-neutral-400 mt-1">Header row is auto-detected and skipped. Middle name may be left blank.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleRosterUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                  className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                  {isUploading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {isUploading ? 'Uploading...' : 'Upload Roster (.xlsx)'}
                </button>
                {rosterEntries.length > 0 && (
                  <button onClick={handleClearRoster} disabled={isClearing}
                    className="flex items-center gap-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                    {isClearing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Clear Roster
                  </button>
                )}
              </div>

              {rosterMsg && (
                <p className={`text-xs font-medium ${rosterMsg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{rosterMsg.text}</p>
              )}

              {rosterEntries.length > 0 && (
                <div className="max-h-52 overflow-y-auto border border-neutral-100 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 text-neutral-400 uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="py-2 px-3 text-left font-semibold">Employee ID</th>
                        <th className="py-2 px-3 text-left font-semibold">Full Name</th>
                        <th className="py-2 px-3 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {rosterEntries.map(e => (
                        <tr key={e.id}>
                          <td className="py-2 px-3 font-mono">{e.employeeId}</td>
                          <td className="py-2 px-3 text-neutral-700">
                            {[e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || '—'}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${e.isClaimed ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                              {e.isClaimed ? 'Claimed' : 'Available'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              className="w-full text-xs pl-9 pr-4 py-2.5 border border-neutral-200 bg-white text-neutral-850 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-white border border-neutral-200 text-neutral-700 text-sm rounded-lg px-3 py-2 h-9 focus:outline-none focus:ring-1 focus:ring-neutral-300 hover:bg-neutral-50 cursor-pointer">
              <option value="all">All Statuses</option>
              <option value="pending">Pending Approval</option>
              <option value="active">Active / Approved</option>
            </select>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="bg-white border border-neutral-200 text-neutral-700 text-sm rounded-lg px-3 py-2 h-9 focus:outline-none focus:ring-1 focus:ring-neutral-300 hover:bg-neutral-50 cursor-pointer">
              <option value="all">All Roles</option>
              {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Users table */}
      {isLoading && systemUsers.length === 0 ? (
        <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
          <Loader className="w-6 h-6 text-neutral-400 animate-spin" />
          <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">Loading accounts...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-16 text-center shadow-sm">
          <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-xs font-semibold text-neutral-800">No matching users found</h3>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xl shadow-neutral-200/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] uppercase font-bold text-neutral-400">
                  <th className="py-3 px-6">User</th>
                  <th className="py-3 px-6">Role</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Joined</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {filteredUsers.map(user => {
                  const isMe = user.id === currentUser.id;
                  const isUpdating = updatingUserId === user.id;
                  const joinDate = new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

                  return (
                    <tr key={user.id} className="hover:bg-neutral-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-neutral-600 text-xs border border-neutral-200 uppercase shrink-0">
                            {user.displayName ? user.displayName.slice(0, 2) : 'US'}
                          </div>
                          <div>
                            <div className="font-semibold text-neutral-850 flex items-center gap-1.5 flex-wrap">
                              <span>{user.displayName || 'Unidentified Profile'}</span>
                              {isMe && (
                                <span className="bg-neutral-900 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">YOU</span>
                              )}
                              {user.pendingEmployeeId && (
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold">
                                  {user.pendingEmployeeId}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {isAdmin && !isMe ? (
                          <select value={user.role} disabled={isUpdating} onChange={e => handleUpdateRole(user.id, e.target.value)}
                            className="text-xs bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200 hover:border-neutral-300 rounded p-1 font-medium focus:outline-none cursor-pointer transition-colors">
                            {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span className="font-semibold text-neutral-700 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-[10px]">{user.role}</span>
                        )}
                      </td>

                      <td className="py-4 px-6">{getStatusBadge(user)}</td>

                      <td className="py-4 px-6 font-mono text-[10px] text-neutral-500">{joinDate}</td>

                      <td className="py-4 px-6 text-right">
                        {isUpdating ? (
                          <Loader className="w-4 h-4 text-neutral-400 animate-spin ml-auto" />
                        ) : isMe ? (
                          <span className="text-[10px] text-neutral-400 italic">Protected Seat</span>
                        ) : !user.isActive ? (
                          <div className="flex items-center justify-end gap-2">
                            {isAdmin && (
                              user.pendingEmployeeId ? (
                                // New-style: employee ID already set at registration — one-click approve
                                <button onClick={() => handleQuickApprove(user)}
                                  className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 text-[11px] font-semibold py-1 px-3 rounded-md shadow-sm transition-colors cursor-pointer">
                                  <UserCheck2 className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                              ) : (
                                // Legacy: no employee ID stored — use modal with dropdown
                                <button onClick={() => openLinkModal(user)}
                                  className="flex items-center gap-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-[11px] font-semibold py-1 px-3 rounded-md transition-colors cursor-pointer">
                                  <Link2 className="w-3.5 h-3.5" />
                                  <span>Link & Approve</span>
                                </button>
                              )
                            )}
                          </div>
                        ) : (
                          <button onClick={() => handleUpdateStatus(user.id, user.isActive)}
                            className="flex items-center gap-1 border border-neutral-200 text-neutral-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-[11px] font-semibold py-1 px-3 rounded-md transition-colors cursor-pointer">
                            <UserX className="w-3.5 h-3.5" />
                            <span>Suspend</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve & Link Modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setLinkModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Approve & Link Employee</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Link <span className="font-medium text-neutral-700">{linkModal.user.email}</span> to an employee roster record and activate their account.
              </p>
            </div>

            {linkError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{linkError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Employee ID</label>
                {unclaimedEmployees.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    No unclaimed employee records found. Upload a roster first.
                  </p>
                ) : (() => {
                  const filtered = unclaimedEmployees.filter(e => {
                    const q = empSearch.toLowerCase();
                    const fullName = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ').toLowerCase();
                    return e.employeeId.toLowerCase().includes(q) || fullName.includes(q);
                  });
                  return (
                    <div className="border border-neutral-200 rounded-lg overflow-hidden">
                      <div className="relative border-b border-neutral-200">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search by ID or name..."
                          value={empSearch}
                          onChange={e => setEmpSearch(e.target.value)}
                          className="w-full text-xs pl-9 pr-3 py-2.5 bg-white focus:outline-none focus:bg-neutral-50 placeholder:text-neutral-400"
                        />
                      </div>
                      <ul className="max-h-44 overflow-y-auto divide-y divide-neutral-100">
                        {filtered.length === 0 ? (
                          <li className="px-3 py-3 text-xs text-neutral-400 text-center">No matching employees</li>
                        ) : filtered.map(e => {
                          const fullName = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') || 'Unnamed';
                          const isSelected = selectedEmpId === e.employeeId;
                          return (
                            <li
                              key={e.id}
                              onClick={() => setSelectedEmpId(e.employeeId)}
                              className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors text-xs ${
                                isSelected
                                  ? 'bg-neutral-900 text-white'
                                  : 'hover:bg-neutral-50 text-neutral-700'
                              }`}
                            >
                              <span className="font-medium">{fullName}</span>
                              <span className={`font-mono text-[10px] ${isSelected ? 'text-neutral-300' : 'text-neutral-400'}`}>
                                {e.employeeId}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Assign Role</label>
                <select value={linkRole} onChange={e => setLinkRole(e.target.value)}
                  className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900">
                  {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setLinkModal(null)}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors">
                Cancel
              </button>
              <button onClick={handleApproveAndLink} disabled={isLinking || !selectedEmpId}
                className="flex-1 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2">
                {isLinking ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <UserCheck2 className="w-3.5 h-3.5" />}
                {isLinking ? 'Approving...' : 'Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
