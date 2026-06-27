import React, { useState, useEffect, useRef } from 'react';
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
  Link2,
  UserPlus,
  Copy,
  KeyRound,
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


  // Link & Approve modal state
  const [linkModal, setLinkModal] = useState<{ user: SystemUser } | null>(null);
  const [unclaimedEmployees, setUnclaimedEmployees] = useState<RosterEntry[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [linkRole, setLinkRole] = useState('Member');
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [skipEmpId, setSkipEmpId] = useState(false);

  // Add Employee modal state (admin direct-create)
  const [addEmpModal, setAddEmpModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('Member');
  const [newEmpPin, setNewEmpPin] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdPinInfo, setCreatedPinInfo] = useState<{ name: string; email: string; pin: string } | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{ userId: number; currentStatus: boolean; userName: string } | null>(null);

  const generatePin = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const rolesList = ['System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor', 'Member'];

  useEffect(() => {
    fetchUsers();
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

  const fetchUnclaimed = async () => {
    try {
      const res = await fetch('/api/settings/unclaimed-employees', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUnclaimedEmployees(await safeReadJson(res));
    } catch {}
  };


  const openLinkModal = async (user: SystemUser) => {
    setLinkModal({ user });
    setSelectedEmpId('');
    setEmpSearch('');
    setLinkRole('Member');
    setLinkError(null);
    setSkipEmpId(false);
    await fetchUnclaimed();
  };

  const handleApproveAndLink = async () => {
    if (!linkModal) return;
    if (!skipEmpId && !selectedEmpId) return;
    setIsLinking(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/users/${linkModal.user.id}/approve-and-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeeId: selectedEmpId, role: linkRole, skipEmployeeId: skipEmpId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to approve user.'); }
      setLinkModal(null);
      await fetchUsers();
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
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleUpdateStatus = async (userId: number, currentStatus: boolean) => {
    setStatusConfirm(null);
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

  const handleAdminCreate = async () => {
    if (!newEmpName.trim() || !newEmpEmail.trim() || !newEmpPin.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/users/admin-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: newEmpName.trim(), email: newEmpEmail.trim(), role: newEmpRole, tempPin: newEmpPin.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to create user.'); }
      const pinSnapshot = newEmpPin.trim();
      const nameSnapshot = newEmpName.trim();
      const emailSnapshot = newEmpEmail.trim();
      setAddEmpModal(false);
      setNewEmpName(''); setNewEmpEmail(''); setNewEmpRole('Member'); setNewEmpPin('');
      setCreatedPinInfo({ name: nameSnapshot, email: emailSnapshot, pin: pinSnapshot });
      await fetchUsers();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
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
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-600">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Pending Approval
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-neutral-600">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        Approved & Active
      </span>
    );
  };

  const isAdmin = currentUser.role === 'System Admin';

  return (
    <div className="flex-grow p-4 md:p-8 overflow-y-auto h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-neutral-900">System User Accounts</h1>
          <p className="text-xs text-neutral-400 mt-1">Review registrations, approve members, and manage staff access privileges.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => { setAddEmpModal(true); setCreateError(null); setNewEmpPin(generatePin()); }}
              className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm cursor-pointer">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Employee</span>
            </button>
          )}
          <button onClick={fetchUsers} disabled={isLoading}
            className="flex items-center gap-1.5 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
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
              className="flex-1 min-w-0 bg-white border border-neutral-200 text-neutral-700 text-sm rounded-lg px-3 py-2 h-9 focus:outline-none focus:ring-1 focus:ring-neutral-300 hover:bg-neutral-50 cursor-pointer">
              <option value="all">All Statuses</option>
              <option value="pending">Pending Approval</option>
              <option value="active">Active / Approved</option>
            </select>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="flex-1 min-w-0 bg-white border border-neutral-200 text-neutral-700 text-sm rounded-lg px-3 py-2 h-9 focus:outline-none focus:ring-1 focus:ring-neutral-300 hover:bg-neutral-50 cursor-pointer">
              <option value="all">All Roles</option>
              {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all') && (
              <button onClick={() => { setSearchTerm(''); setStatusFilter('all'); setRoleFilter('all'); }}
                className="shrink-0 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-red-500 border border-neutral-200 hover:border-red-200 rounded-lg px-2.5 py-2 h-9 transition-colors cursor-pointer whitespace-nowrap">
                <XCircle className="w-3.5 h-3.5" />Clear
              </button>
            )}
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
        <>
          {/* Mobile cards — visible below md */}
          <div className="md:hidden space-y-3">
            {filteredUsers.map(user => {
              const isMe = user.id === currentUser.id;
              const isUpdating = updatingUserId === user.id;
              return (
                <div key={user.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-neutral-600 text-xs border border-neutral-200 uppercase shrink-0">
                      {user.displayName ? user.displayName.slice(0, 2) : 'US'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-neutral-900 truncate">{user.displayName || 'Unidentified Profile'}</span>
                        {isMe && <span className="bg-neutral-900 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide shrink-0">YOU</span>}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono truncate mt-0.5">{user.email}</div>
                      {user.pendingEmployeeId && (
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">ID: {user.pendingEmployeeId}</div>
                      )}
                      <div className="mt-1.5">{getStatusBadge(user)}</div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {isAdmin && !isMe ? (
                        <select value={user.role} disabled={isUpdating} onChange={e => handleUpdateRole(user.id, e.target.value)}
                          className="text-xs bg-white text-neutral-800 border border-neutral-200 rounded p-1 font-medium focus:outline-none cursor-pointer">
                          {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-1 rounded">{user.role}</span>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isUpdating ? (
                        <Loader className="w-4 h-4 text-neutral-400 animate-spin" />
                      ) : isMe ? (
                        <span className="text-[10px] text-neutral-400 italic">Protected</span>
                      ) : !user.isActive ? (
                        isAdmin && (
                          user.pendingEmployeeId ? (
                            <button onClick={() => handleQuickApprove(user)}
                              className="flex items-center gap-1 bg-neutral-900 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg cursor-pointer">
                              <UserCheck2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          ) : (
                            <button onClick={() => openLinkModal(user)}
                              className="flex items-center gap-1 border border-neutral-300 text-neutral-700 text-[11px] font-semibold py-1.5 px-3 rounded-lg cursor-pointer">
                              <Link2 className="w-3.5 h-3.5" />
                              <span>Link & Approve</span>
                            </button>
                          )
                        )
                      ) : (
                        <button onClick={() => setStatusConfirm({ userId: user.id, currentStatus: user.isActive, userName: user.displayName || user.email })}
                          title="Suspends this user's login access."
                          className="flex items-center gap-1 border border-neutral-200 text-neutral-600 text-[11px] font-semibold py-1.5 px-3 rounded-lg cursor-pointer">
                          <UserX className="w-3.5 h-3.5" />
                          <span>Suspend</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table — visible from md up */}
          <div className="hidden md:block bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xl shadow-neutral-200/20">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] uppercase font-bold text-neutral-400">
                    <th className="py-3 px-6">User</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Employee ID</th>
                    <th className="py-3 px-6">Role</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 hidden md:table-cell">Joined</th>
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
                              <div className="font-semibold text-neutral-850 flex items-center gap-1.5">
                                <span>{user.displayName || 'Unidentified Profile'}</span>
                                {isMe && (
                                  <span className="bg-neutral-900 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">YOU</span>
                                )}
                              </div>
                              <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 hidden sm:table-cell">
                          {user.pendingEmployeeId ? (
                            <span className="text-[10px] text-neutral-500 font-mono whitespace-nowrap">
                              {user.pendingEmployeeId}
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-300 italic">—</span>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          {isAdmin && !isMe ? (
                            <select value={user.role} disabled={isUpdating} onChange={e => handleUpdateRole(user.id, e.target.value)}
                              className="text-xs bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200 hover:border-neutral-300 rounded p-1 font-medium focus:outline-none cursor-pointer transition-colors">
                              {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          ) : (
                            <span className="inline-flex items-center font-semibold text-neutral-700 bg-neutral-100 border border-neutral-200 px-2 py-1 rounded text-xs h-[30px]">{user.role}</span>
                          )}
                        </td>

                        <td className="py-4 px-6">{getStatusBadge(user)}</td>

                        <td className="py-4 px-6 font-mono text-[10px] text-neutral-500 hidden md:table-cell">{joinDate}</td>

                        <td className="py-4 px-6 text-right">
                          {isUpdating ? (
                            <Loader className="w-4 h-4 text-neutral-400 animate-spin ml-auto" />
                          ) : isMe ? (
                            <span className="text-[10px] text-neutral-400 italic">Protected Seat</span>
                          ) : !user.isActive ? (
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              {isAdmin && (
                                user.pendingEmployeeId ? (
                                  <button onClick={() => handleQuickApprove(user)}
                                    className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 text-[11px] font-semibold py-1 px-3 rounded-md shadow-sm transition-colors cursor-pointer">
                                    <UserCheck2 className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </button>
                                ) : (
                                  <button onClick={() => openLinkModal(user)}
                                    className="flex items-center gap-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-[11px] font-semibold py-1 px-3 rounded-md transition-colors cursor-pointer">
                                    <Link2 className="w-3.5 h-3.5" />
                                    <span>Link & Approve</span>
                                  </button>
                                )
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => setStatusConfirm({ userId: user.id, currentStatus: user.isActive, userName: user.displayName || user.email })}
                              title="Suspends this user's login access. They will be blocked from signing into the system until reactivated."
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
        </>
      )}

      {/* Add Employee Modal */}
      {addEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setAddEmpModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Add Employee Account</h2>
              <p className="text-xs text-neutral-500 mt-1">Manually create an active account for owners or staff not in the HR roster.</p>
            </div>

            {createError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{createError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Juan Dela Cruz"
                  value={newEmpName}
                  onChange={e => setNewEmpName(e.target.value)}
                  className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. owner@coop.local"
                  value={newEmpEmail}
                  onChange={e => setNewEmpEmail(e.target.value)}
                  className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Role</label>
                <select value={newEmpRole} onChange={e => setNewEmpRole(e.target.value)}
                  className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900">
                  {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Temporary Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Welcome@2024"
                    value={newEmpPin}
                    onChange={e => setNewEmpPin(e.target.value)}
                    className="flex-1 text-sm font-mono border border-neutral-200 bg-white rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 tracking-wide"
                  />
                  <button type="button" onClick={() => setNewEmpPin(generatePin())}
                    className="text-xs border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 px-3 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                    Generate
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">Employee uses this to log in with their email on the login screen. It will be emailed to them automatically.</p>
              </div>
              <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 text-[11px] rounded-lg leading-relaxed">
                The account will be created as <span className="font-semibold">Approved & Active</span> immediately. Credentials will be sent to the employee's email.
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setAddEmpModal(false)}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors">
                Cancel
              </button>
              <button onClick={handleAdminCreate} disabled={isCreating || !newEmpName.trim() || !newEmpEmail.trim() || newEmpPin.trim().length < 4}
                className="flex-1 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2">
                {isCreating ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                {isCreating ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Created Success Dialog */}
      {createdPinInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setCreatedPinInfo(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Account Created</h2>
                <p className="text-xs text-neutral-500">Temporary password has been emailed. Share it securely if needed.</p>
              </div>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-1.5">
              <div className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest">Employee</div>
              <div className="text-sm font-semibold text-neutral-900">{createdPinInfo.name}</div>
              <div className="text-xs text-neutral-500 font-mono">{createdPinInfo.email}</div>
            </div>

            <div className="bg-neutral-900 rounded-xl p-4 text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Temporary Password</div>
              <div className="text-3xl font-mono font-bold text-white tracking-[0.3em]">{createdPinInfo.pin}</div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdPinInfo.pin);
                  setPinCopied(true);
                  setTimeout(() => setPinCopied(false), 2000);
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" /> {pinCopied ? 'Copied!' : 'Copy Password'}
              </button>
            </div>

            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
              This password has been emailed to the employee. They can log in using their email address and this password on the login screen.
            </p>

            <button onClick={() => setCreatedPinInfo(null)}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors">
              Done
            </button>
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
              <label className="flex items-center gap-2.5 cursor-pointer select-none p-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors">
                <input type="checkbox" checked={skipEmpId} onChange={e => setSkipEmpId(e.target.checked)}
                  className="rounded border-neutral-300 text-neutral-900 cursor-pointer" />
                <div>
                  <div className="text-xs font-semibold text-neutral-800">Approve without Employee ID</div>
                  <div className="text-[10px] text-neutral-400">For owners and external stakeholders not in the roster.</div>
                </div>
              </label>

              {!skipEmpId && <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Employee ID</label>
                {unclaimedEmployees.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    No unclaimed employee records found in HR roster.
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
              </div>}

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
              <button onClick={handleApproveAndLink} disabled={isLinking || (!skipEmpId && !selectedEmpId)}
                className="flex-1 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2">
                {isLinking ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <UserCheck2 className="w-3.5 h-3.5" />}
                {isLinking ? 'Approving...' : 'Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend / Activate Confirmation Modal */}
      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full shrink-0 ${statusConfirm.currentStatus ? 'bg-red-50' : 'bg-emerald-50'}`}>
                {statusConfirm.currentStatus
                  ? <UserX className="w-4 h-4 text-red-500" />
                  : <UserCheck2 className="w-4 h-4 text-emerald-600" />}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  {statusConfirm.currentStatus ? 'Suspend User?' : 'Reactivate User?'}
                </h2>
                <p className="text-xs font-medium text-neutral-700 mt-0.5 truncate">{statusConfirm.userName}</p>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {statusConfirm.currentStatus
                    ? 'This will block the user from logging in until reactivated.'
                    : 'This will restore the user\'s login access.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setStatusConfirm(null)}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors">
                Cancel
              </button>
              <button onClick={() => handleUpdateStatus(statusConfirm.userId, statusConfirm.currentStatus)}
                className={`flex-1 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors ${
                  statusConfirm.currentStatus ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}>
                {statusConfirm.currentStatus ? 'Suspend' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
