import React, { useState, useEffect } from 'react';
import { Member, LedgerLine, User, AppSettings } from '../types.ts';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  UserPlus,
  X,
  CreditCard,
  Building,
  Mail,
  Phone,
  ArrowRight,
  Loader,
  XCircle,
  CheckCircle,
  FileText,
  UserCheck2,
  AlertTriangle,
  MapPin,
  RefreshCw,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  UserX,
  UserCheck,
  HandCoins,
} from 'lucide-react';
import InfoButton from './InfoButton.tsx';

interface EligibleUser {
  id: number;
  email: string;
  displayName: string | null;
  employeeId: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
}

interface MembersModuleProps {
  currentUser: User;
  token: string;
  settings: AppSettings;
}

export default function MembersModule({ currentUser, token, settings }: MembersModuleProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [linkUserEmail, setLinkUserEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<{ id: number; name: string; code: string }[]>([]);

  // User picker for create mode
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userPickerSearch, setUserPickerSearch] = useState('');
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  // Drawer states
  const [activeDrawerMember, setActiveDrawerMember] = useState<Member | null>(null);
  const [drawerDetails, setDrawerDetails] = useState<any | null>(null);
  const [drawerLedger, setDrawerLedger] = useState<LedgerLine[]>([]);
  const [drawerActiveLoan, setDrawerActiveLoan] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Row action menu + status confirmation modal
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ member: Member; action: 'suspend' | 'activate' } | null>(null);

  useEffect(() => {
    fetchMembers();
    fetch('/api/terms/departments', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setDepartmentOptions(data.filter((d: any) => d.isActive)))
      .catch(() => {});
  }, [token]);

  const fetchEligibleUsers = async () => {
    try {
      const res = await fetch('/api/users/eligible-for-member', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setEligibleUsers(await res.json());
    } catch {}
  };

  const handleSelectEligibleUser = (u: EligibleUser) => {
    setSelectedUserId(u.id);
    setFirstName(u.firstName || '');
    setLastName(u.lastName || '');
    setEmployeeId(u.employeeId || '');
    setEmail(u.email);
    setLinkUserEmail(u.email);
    setUserPickerOpen(false);
    setUserPickerSearch('');
  };

  const fetchMembers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/members', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to retrieve cooperative members list.');
      }
      const data = await res.json();
      setMembers(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedMember(null);
    setFirstName('');
    setLastName('');
    setEmployeeId('');
    setEmail('');
    setPhone('');
    setDepartment('');
    setLinkUserEmail('');
    setSelectedUserId(null);
    setUserPickerSearch('');
    setUserPickerOpen(false);
    fetchEligibleUsers();
    setShowFormModal(true);
  };

  const handleOpenEdit = (member: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormMode('edit');
    setSelectedMember(member);
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setEmployeeId(member.employeeId);
    setEmail(member.email);
    setPhone(member.phone || '');
    setDepartment(member.department || '');
    setLinkUserEmail(''); // we can look up matched logins or keep empty
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const payload = {
      firstName,
      lastName,
      employeeId,
      email,
      phone,
      department,
      linkUserEmail: linkUserEmail || null,
    };

    try {
      const url = formMode === 'create' ? '/api/members' : `/api/members/${selectedMember?.id}`;
      const method = formMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Server error saving member record.');
      }

      setShowFormModal(false);
      fetchMembers();
      if (activeDrawerMember && activeDrawerMember.id === selectedMember?.id) {
        // Refresh active drawer as well
        handleSelectMember(selectedMember);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (member: Member) => {
    try {
      const res = await fetch(`/api/members/${member.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update member status.');
      }
      setConfirmModal(null);
      fetchMembers();
    } catch (err: any) {
      setErrorMessage(err.message);
      setConfirmModal(null);
    }
  };

  const handleSelectMember = async (member: Member) => {
    setActiveDrawerMember(member);
    setDrawerLoading(true);
    setDrawerDetails(null);
    setDrawerLedger([]);
    setDrawerActiveLoan(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [detailRes, ledgerRes, activeLoanRes] = await Promise.all([
        fetch(`/api/members/${member.id}`, { headers }),
        fetch(`/api/reports/member-ledger/${member.id}`, { headers }),
        fetch(`/api/loan-applications/active?memberId=${member.id}`, { headers }),
      ]);

      if (!detailRes.ok) throw new Error('Could not get member balances.');
      setDrawerDetails(await detailRes.json());

      if (ledgerRes.ok) setDrawerLedger(await ledgerRes.json());

      if (activeLoanRes.ok) {
        const loans = await activeLoanRes.json();
        setDrawerActiveLoan(loans[0] ?? null); // most recent active loan
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const filteredMembers = members.filter(m => {
    const full = `${m.firstName} ${m.lastName} ${m.employeeId} ${m.email} ${m.department || ''}`.toLowerCase();
    return full.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex-grow p-4 md:p-8 overflow-y-auto relative h-screen">
      {/* Top Header Controls */}
      <div className="flex items-start justify-between gap-3 mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-medium tracking-tight text-neutral-900 font-sans">
              Members Directory
            </h1>
            <InfoButton text="This is where you manage cooperative members. Add new members, view their savings and investment balances, and browse their full transaction history. Click any member row to open their account details." />
          </div>
          <p className="text-xs text-neutral-400 mt-1 hidden sm:block">
            Register and coordinate cooperative members and their accounts.
          </p>
        </div>

        {['System Admin', 'Manager', 'Accounting Officer', 'Cashier'].includes(currentUser.role) && (
          <button
            onClick={handleOpenCreate}
            className="shrink-0 flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Member Profile</span>
            <span className="sm:hidden">Add</span>
          </button>
        )}
      </div>

      {/* Main Container: Split screen when Detail Drawer is open */}
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        {/* Table List Section */}
        <div className="flex-grow bg-white border border-neutral-200/80 rounded-xl shadow-xl shadow-neutral-200/20 overflow-hidden">
          {/* Table Header Filter bar */}
          <div className="p-4 border-b border-neutral-150 bg-neutral-50/40 flex items-center gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400 shrink-0" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400 text-neutral-800 placeholder-neutral-400"
              />
            </div>
            <button
              onClick={fetchMembers}
              className="shrink-0 p-2 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
              title="Refresh profiles list"
            >
              <RefreshCw className="w-4 h-4 text-neutral-500" />
            </button>
            {searchTerm && (
              <span className="text-[10px] text-neutral-400 font-medium bg-neutral-100 rounded-full px-2 py-0.5 shrink-0">
                {filteredMembers.length}
              </span>
            )}
          </div>

          {/* Table Body */}
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Loader className="w-6 h-6 text-neutral-400 animate-spin" />
              <span className="text-xs text-neutral-500 font-medium">Downloading member directory...</span>
            </div>
          ) : errorMessage ? (
            <div className="py-24 px-6 text-center max-w-md mx-auto flex flex-col items-center gap-3">
              <XCircle className="w-8 h-8 text-red-500 shrink-0" />
              <div className="text-xs font-semibold text-neutral-800">Connection Error</div>
              <p className="text-[11px] text-neutral-500">{errorMessage}</p>
              <button onClick={fetchMembers} className="text-xs text-neutral-800 underline hover:text-black font-semibold">
                Retry Request
              </button>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-24 text-center max-w-xs mx-auto flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-semibold text-neutral-800">No Members Found</h3>
              <p className="text-[11px] text-neutral-400">
                {searchTerm ? 'Refine your search constraints.' : 'Introduce the first cooperative member profile.'}
              </p>
              {!searchTerm && (
                <button
                  onClick={handleOpenCreate}
                  className="mt-2 flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors cursor-pointer">
                  Add First Member
                </button>
              )}
            </div>
          ) : activeDrawerMember ? (
            /* Compact list — shown when the detail drawer is open */
            <ul className="divide-y divide-neutral-100">
              {filteredMembers.map((member) => {
                const isSelected = activeDrawerMember?.id === member.id;
                const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`.toUpperCase();
                return (
                  <li
                    key={member.id}
                    onClick={() => handleSelectMember(member)}
                    className={`relative flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-neutral-50' : 'hover:bg-neutral-50/60'
                    }`}
                  >
                    {/* Left accent bar for selected */}
                    {isSelected && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-neutral-900 rounded-full" />
                    )}
                    <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[11px] font-bold shrink-0 text-neutral-600 uppercase">
                      {initials || '??'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs truncate ${isSelected ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'}`}>
                        {member.firstName} {member.lastName}
                      </div>
                      <div className="text-[10px] font-mono truncate mt-0.5 text-neutral-400">
                        {member.employeeId || <span className="italic not-italic text-neutral-300">No ID</span>}
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      member.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                    }`}>
                      {member.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              {/* Mobile: card list */}
              <ul className="divide-y divide-neutral-100 md:hidden">
                {filteredMembers.map((member) => {
                  const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`.toUpperCase();
                  const canManage = ['System Admin', 'Manager', 'Accounting Officer', 'Cashier'].includes(currentUser.role);
                  return (
                    <li key={member.id} className="px-4 py-3.5">
                      <div className="flex items-center gap-3" onClick={() => handleSelectMember(member)}>
                        <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600 shrink-0 uppercase">
                          {initials || '??'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-neutral-900 text-sm truncate">{member.firstName} {member.lastName}</div>
                          <div className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">{member.employeeId || '—'}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {member.department && <span className="text-[10px] text-neutral-500">{member.department}</span>}
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${member.isActive ? 'text-emerald-600' : 'text-neutral-400'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${member.isActive ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                              {member.isActive ? 'Active' : 'Suspended'}
                            </span>
                          </div>
                        </div>
                        {canManage && (
                          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                              className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-500 cursor-pointer"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {openMenuId === member.id && (
                              <div className="absolute right-0 top-9 z-20 w-40 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden">
                                <button onClick={() => { setOpenMenuId(null); handleOpenEdit(member, { stopPropagation: () => {} } as any); }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-neutral-700 hover:bg-neutral-50 cursor-pointer">
                                  <Pencil className="w-3.5 h-3.5 text-neutral-400" />Edit Profile
                                </button>
                                {['System Admin', 'Manager', 'Accounting Officer'].includes(currentUser.role) && (
                                  <button onClick={() => { setOpenMenuId(null); setConfirmModal({ member, action: member.isActive ? 'suspend' : 'activate' }); }}
                                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs cursor-pointer border-t border-neutral-100 ${member.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`}>
                                    {member.isActive ? <><UserX className="w-3.5 h-3.5" />Suspend</> : <><UserCheck className="w-3.5 h-3.5" />Activate</>}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop: full table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500 text-[10px] uppercase font-semibold border-b border-neutral-150">
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4 w-20 text-center">Status</th>
                      {['System Admin', 'Manager', 'Accounting Officer', 'Cashier'].includes(currentUser.role) && (
                        <th className="py-3 px-4 w-24 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-150 text-xs">
                    {filteredMembers.map((member) => {
                      const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`.toUpperCase();
                      return (
                        <tr key={member.id} onClick={() => handleSelectMember(member)} className="hover:bg-neutral-50/50 cursor-pointer transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[11px] font-bold text-neutral-500 shrink-0 uppercase">
                                {initials || '??'}
                              </div>
                              <div>
                                <div className="font-semibold text-neutral-900">{member.firstName} {member.lastName}</div>
                                <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{member.employeeId || <span className="italic">No ID</span>}</div>
                                <div className="text-[10px] text-neutral-400 mt-0.5 truncate max-w-[220px]">{member.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-neutral-500 text-xs">{member.department || '—'}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              member.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                            }`}>{member.isActive ? 'Active' : 'Suspended'}</span>
                          </td>
                          {['System Admin', 'Manager', 'Accounting Officer', 'Cashier'].includes(currentUser.role) && (
                            <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="relative inline-block">
                                <button onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                                  className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer">
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                                {openMenuId === member.id && (
                                  <div className="absolute right-0 top-8 z-20 w-40 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden" onMouseLeave={() => setOpenMenuId(null)}>
                                    <button onClick={() => { setOpenMenuId(null); handleOpenEdit(member, { stopPropagation: () => {} } as any); }}
                                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer">
                                      <Pencil className="w-3.5 h-3.5 text-neutral-400" />Edit Profile
                                    </button>
                                    {['System Admin', 'Manager', 'Accounting Officer'].includes(currentUser.role) && (
                                      <button onClick={() => { setOpenMenuId(null); setConfirmModal({ member, action: member.isActive ? 'suspend' : 'activate' }); }}
                                        title={member.isActive ? "Suspends this member's cooperative account." : "Restores this member's active membership."}
                                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-colors cursor-pointer border-t border-neutral-100 ${member.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`}>
                                        {member.isActive ? <><UserX className="w-3.5 h-3.5" />Suspend Member</> : <><UserCheck className="w-3.5 h-3.5" />Activate Member</>}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Member Drawer Panel — fixed overlay on mobile, sticky side panel on desktop */}
        <AnimatePresence>
          {activeDrawerMember && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-40 bg-white flex flex-col lg:static lg:inset-auto lg:z-auto lg:rounded-xl lg:border lg:border-neutral-200 lg:shadow-2xl lg:shrink-0 lg:overflow-hidden lg:w-[45%] lg:h-[calc(100vh-140px)] lg:sticky lg:top-[100px]"
            >
              {/* Drawer Header */}
              <div className="p-4 lg:p-5 border-b border-neutral-150 bg-neutral-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-950 font-sans">
                    Member Account
                  </h2>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">
                    ID: {activeDrawerMember.employeeId}
                  </p>
                </div>
                <button
                  onClick={() => setActiveDrawerMember(null)}
                  className="flex items-center gap-1.5 lg:gap-0 text-xs font-medium text-neutral-500 hover:text-black lg:text-transparent lg:p-1 lg:rounded-full lg:hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span className="lg:hidden">Back</span>
                </button>
              </div>

              {/* Drawer Content */}
              {drawerLoading ? (
                <div className="flex-grow flex flex-col items-center justify-center gap-3">
                  <Loader className="w-5 h-5 text-neutral-400 animate-spin" />
                  <span className="text-xs text-neutral-500 font-medium">Loading account details...</span>
                </div>
              ) : (
                <div className="flex-grow overflow-y-auto p-5 space-y-6">
                  {/* Biography Box */}
                  <div className="space-y-2.5">
                    <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                      Biographical Summary
                    </h3>
                    <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200/50 text-xs text-neutral-600 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase text-neutral-400 font-semibold flex items-center gap-1">
                          <UserCheck2 className="w-3 h-3 text-neutral-500 shrink-0" /> Full Name
                        </div>
                        <div className="text-neutral-800 font-medium">
                          {activeDrawerMember.firstName} {activeDrawerMember.lastName}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase text-neutral-400 font-semibold flex items-center gap-1">
                          <Building className="w-3 h-3 text-neutral-500 shrink-0" /> Department
                        </div>
                        <div className="text-neutral-800 font-medium">
                          {activeDrawerMember.department || 'Not Assigned'}
                        </div>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <div className="text-[10px] uppercase text-neutral-400 font-semibold flex items-center gap-1">
                          <Mail className="w-3 h-3 text-neutral-500 shrink-0" /> Enterprise Email
                        </div>
                        <div className="text-neutral-800 font-mono select-all truncate">
                          {activeDrawerMember.email}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase text-neutral-400 font-semibold flex items-center gap-1">
                          <Phone className="w-3 h-3 text-neutral-500 shrink-0" /> Hot Phone
                        </div>
                        <div className="text-neutral-800 font-mono">
                          {activeDrawerMember.phone || 'None Registered'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase text-neutral-400 font-semibold flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-neutral-500 shrink-0" /> Portal Link
                        </div>
                        <div className="text-neutral-800 truncate">
                          {activeDrawerMember.userId ? 'Synced login' : 'Memb-Portal off'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Derived Financial Balances (Single source of truth ledger sum boxes) */}
                  <div className="space-y-2.5">
                    <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center justify-between">
                      <span>Account Balances</span>
                      <span className="text-[9px] font-sans text-neutral-500 flex items-center border border-neutral-200 bg-neutral-100 rounded px-1 lowercase">
                        *calculated from transactions
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Savings Balance Box */}
                      <div className="bg-neutral-900 text-white rounded-lg p-3.5 shadow-sm border border-neutral-950 flex flex-col justify-between">
                        <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                          Savings Deposits
                        </div>
                        <div className="mt-2.5 font-sans font-medium tracking-tight text-[18px]">
                          {settings.currencySymbol}{drawerDetails?.balances ? (drawerDetails.balances.savingsInCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </div>
                        <div className="text-[9px] text-neutral-400 font-mono mt-1">COA Code: 2010</div>
                      </div>

                      {/* Share Capital Balance Box */}
                      <div className="bg-white border border-neutral-350 rounded-lg p-3.5 flex flex-col justify-between">
                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Membership Investment
                        </div>
                        <div className="mt-2.5 font-sans font-medium tracking-tight text-[18px] text-neutral-900">
                          {settings.currencySymbol}{drawerDetails?.balances ? (drawerDetails.balances.shareCapitalInCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </div>
                        <div className="text-[9px] text-neutral-500 font-mono mt-1">COA Code: 3010</div>
                      </div>
                    </div>
                  </div>

                  {/* Active Loan */}
                  {(drawerActiveLoan || (drawerDetails?.balances?.loansOutstandingCents > 0)) && (
                    <div className="space-y-2.5">
                      <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Active Loan</h3>
                      <div className={`rounded-lg p-4 border text-xs flex flex-col gap-3 ${drawerActiveLoan ? 'bg-amber-50 border-amber-200' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HandCoins className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="font-semibold text-neutral-800">{drawerActiveLoan?.loanProductName ?? 'Loan'}</span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Active</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[10px] uppercase text-neutral-400 font-semibold mb-0.5">Outstanding Balance</div>
                            <div className="font-mono font-bold text-amber-700 text-[15px]">
                              {settings.currencySymbol}{((drawerActiveLoan?.outstandingCents ?? drawerDetails?.balances?.loansOutstandingCents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          {drawerActiveLoan && (
                            <div>
                              <div className="text-[10px] uppercase text-neutral-400 font-semibold mb-0.5">Disbursed Amount</div>
                              <div className="font-mono text-neutral-700">
                                {settings.currencySymbol}{(drawerActiveLoan.requestedAmountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                          {drawerActiveLoan?.termMonths && (
                            <div>
                              <div className="text-[10px] uppercase text-neutral-400 font-semibold mb-0.5">Term</div>
                              <div className="text-neutral-700">{drawerActiveLoan.termMonths} months</div>
                            </div>
                          )}
                          {drawerActiveLoan?.disbursedAt && (
                            <div>
                              <div className="text-[10px] uppercase text-neutral-400 font-semibold mb-0.5">Disbursed On</div>
                              <div className="text-neutral-700 font-mono text-[10px]">
                                {new Date(drawerActiveLoan.disbursedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </div>
                          )}
                        </div>
                        {drawerActiveLoan?.loanProductInterestBps && (
                          <div className="text-[10px] text-neutral-500 border-t border-amber-100 pt-2">
                            Interest rate: {drawerActiveLoan.loanProductInterestBps / 100}% / month
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Transaction History entries */}
                  <div className="space-y-2.5">
                    <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                      Transaction History
                    </h3>
                    {drawerLedger.length === 0 ? (
                      <div className="p-8 border border-dashed border-neutral-2550 hover:bg-neutral-50/50 rounded-lg text-center">
                        <FileText className="w-5 h-5 mx-auto text-neutral-400 mb-1" />
                        <span className="text-[10px] text-neutral-500 font-medium">No financial postings made.</span>
                      </div>
                    ) : (
                      <div className="border border-neutral-200 rounded-lg bg-neutral-50/30 overflow-hidden">
                        <div className="overflow-x-auto"><table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-neutral-100/80 text-neutral-500 text-[9px] font-bold border-b border-neutral-150 uppercase tracking-wider">
                              <th className="p-2 w-16">Date</th>
                              <th className="p-2">Description / COA</th>
                              <th className="p-2 text-right">Money Out</th>
                              <th className="p-2 text-right">Money In</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-150 bg-white">
                            {drawerLedger.map((line) => {
                              const date = new Date(line.date).toLocaleDateString();
                              const isReversed = line.status === 'reversed';
                              return (
                                <tr key={line.id} className={`hover:bg-neutral-50/30 ${isReversed ? 'bg-red-50/30 text-neutral-400 line-through' : ''}`}>
                                  <td className="p-2 font-mono text-[9px] text-neutral-500">
                                    {date}
                                  </td>
                                  <td className="p-2">
                                    <div className="font-semibold text-neutral-800">
                                      {line.description}
                                    </div>
                                    <div className="text-[9px] text-neutral-400 font-mono">
                                      Ref: {line.transactionRef} | {line.coaName} ({line.coaCode})
                                    </div>
                                  </td>
                                  <td className="p-2 text-right font-mono font-medium text-neutral-900">
                                    {line.entryType === 'debit' ? `${settings.currencySymbol}(${(line.amount / 100).toFixed(2)})` : ''}
                                  </td>
                                  <td className="p-2 text-right font-mono font-medium text-emerald-700">
                                    {line.entryType === 'credit' ? `${settings.currencySymbol}${(line.amount / 100).toFixed(2)}` : ''}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Click-outside overlay to close row action menu */}
      {openMenuId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}

      {/* Suspend / Activate Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1 ${
              confirmModal.action === 'suspend' ? 'bg-red-50' : 'bg-emerald-50'
            }`}>
              {confirmModal.action === 'suspend'
                ? <UserX className="w-5 h-5 text-red-500" />
                : <UserCheck className="w-5 h-5 text-emerald-600" />
              }
            </div>
            <div className="text-center">
              <h2 className="text-sm font-semibold text-neutral-900">
                {confirmModal.action === 'suspend' ? 'Suspend Member?' : 'Activate Member?'}
              </h2>
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                {confirmModal.action === 'suspend'
                  ? <>This will deactivate <span className="font-semibold text-neutral-800">{confirmModal.member.firstName} {confirmModal.member.lastName}</span>'s membership. They will lose access to cooperative services until reactivated.</>
                  : <>This will restore <span className="font-semibold text-neutral-800">{confirmModal.member.firstName} {confirmModal.member.lastName}</span>'s active membership status.</>
                }
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleStatus(confirmModal.member)}
                className={`flex-1 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                  confirmModal.action === 'suspend'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmModal.action === 'suspend'
                  ? <><UserX className="w-3.5 h-3.5" />Yes, Suspend</>
                  : <><UserCheck className="w-3.5 h-3.5" />Yes, Activate</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT MEMBER MODAL */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-neutral-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative"
            >
              <div className="p-5 border-b border-neutral-150 bg-neutral-50/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900 font-sans">
                  {formMode === 'create' ? 'Register New Member Profile' : 'Update Member Details'}
                </h2>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-black transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">

                {/* CREATE MODE: pick from approved users */}
                {formMode === 'create' && (
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-neutral-400">Select Approved User</label>

                    {/* Picker trigger */}
                    <button
                      type="button"
                      onClick={() => setUserPickerOpen(o => !o)}
                      className={`w-full flex items-center justify-between text-xs border rounded-md px-3 py-2.5 bg-white focus:outline-none transition-colors cursor-pointer ${
                        selectedUserId ? 'border-neutral-300 text-neutral-900' : 'border-neutral-200 text-neutral-400'
                      }`}
                    >
                      <span className="truncate">
                        {selectedUserId
                          ? (() => {
                              const u = eligibleUsers.find(u => u.id === selectedUserId);
                              return u ? `${u.firstName || ''} ${u.lastName || ''} · ${u.employeeId || ''} · ${u.email}` : '— Select a user —';
                            })()
                          : '— Select an approved user —'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-2" />
                    </button>

                    {/* Dropdown */}
                    {userPickerOpen && (
                      <div className="border border-neutral-200 rounded-lg overflow-hidden shadow-md bg-white">
                        <div className="relative border-b border-neutral-100">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search by name, ID or email..."
                            value={userPickerSearch}
                            onChange={e => setUserPickerSearch(e.target.value)}
                            className="w-full text-xs pl-9 pr-3 py-2.5 focus:outline-none placeholder:text-neutral-400"
                          />
                        </div>
                        <ul className="max-h-48 overflow-y-auto divide-y divide-neutral-50">
                          {eligibleUsers.length === 0 ? (
                            <li className="px-3 py-4 text-xs text-neutral-400 text-center">
                              No approved users without a member profile found.
                            </li>
                          ) : (() => {
                            const q = userPickerSearch.toLowerCase();
                            const filtered = eligibleUsers.filter(u =>
                              (u.displayName || '').toLowerCase().includes(q) ||
                              (u.employeeId || '').toLowerCase().includes(q) ||
                              u.email.toLowerCase().includes(q)
                            );
                            return filtered.length === 0 ? (
                              <li className="px-3 py-3 text-xs text-neutral-400 text-center">No matches</li>
                            ) : filtered.map(u => (
                              <li
                                key={u.id}
                                onClick={() => handleSelectEligibleUser(u)}
                                className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-neutral-50 transition-colors"
                              >
                                <div>
                                  <div className="text-xs font-semibold text-neutral-800">
                                    {[u.firstName, u.middleName, u.lastName].filter(Boolean).join(' ') || u.displayName || 'Unknown'}
                                  </div>
                                  <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{u.email}</div>
                                </div>
                                {u.employeeId && (
                                  <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded shrink-0 ml-3">
                                    {u.employeeId}
                                  </span>
                                )}
                              </li>
                            ));
                          })()}
                        </ul>
                      </div>
                    )}

                    {/* Editable fields pre-filled from roster — admin can correct if missing */}
                    {selectedUserId && (
                      <div className="border border-neutral-200 rounded-lg p-3 space-y-2.5 mt-1 bg-neutral-50/50">
                        <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Member Details — review and complete if needed</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">First Name <span className="text-red-400">*</span></label>
                            <input type="text" className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                              value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="First name" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Last Name <span className="text-red-400">*</span></label>
                            <input type="text" className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                              value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Last name" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Employee ID <span className="text-red-400">*</span></label>
                            <div className="flex gap-1">
                              <input type="text" className="flex-1 min-w-0 text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800 font-mono"
                                value={employeeId} onChange={e => setEmployeeId(e.target.value)} required placeholder="EMP-1234" />
                              {!employeeId && (
                                <button type="button"
                                  onClick={() => setEmployeeId('EMP-' + Math.floor(100000 + Math.random() * 900000))}
                                  className="shrink-0 text-[10px] px-2 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-200 font-medium transition-colors">
                                  Generate
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Email</label>
                            <input type="email" className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-neutral-100 text-neutral-500 font-mono"
                              value={email} readOnly />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* EDIT MODE: manual fields */}
                {formMode === 'edit' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase font-bold text-neutral-400">First Name</label>
                        <input type="text" className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                          value={firstName} onChange={e => setFirstName(e.target.value)} required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase font-bold text-neutral-400">Last Name</label>
                        <input type="text" className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                          value={lastName} onChange={e => setLastName(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-neutral-400">
                        Employee ID
                        {currentUser.role !== 'System Admin' && (
                          <span className="ml-1 normal-case font-normal text-neutral-400" title="Only System Admins can change the Employee ID">(locked — contact System Admin)</span>
                        )}
                      </label>
                      <input type="text" className={`w-full text-xs border border-neutral-200 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-mono ${currentUser.role !== 'System Admin' ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' : 'bg-white text-neutral-800'}`}
                        value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                        disabled={currentUser.role !== 'System Admin'} required
                        title={currentUser.role !== 'System Admin' ? 'Only System Admins can change the Employee ID' : undefined} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold text-neutral-400">Enterprise Email Address</label>
                      <input type="email" className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                        value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                  </>
                )}

                {/* Phone + Department — both modes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-neutral-400">Hot Phone</label>
                    <input type="text" className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800 font-mono"
                      value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-neutral-400">Department</label>
                    {departmentOptions.length > 0 ? (
                      <select className="w-full text-xs border border-neutral-200 rounded-md px-2 py-2 h-[34px] bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                        value={department} onChange={e => setDepartment(e.target.value)}>
                        <option value="">— Select department —</option>
                        {departmentOptions.map(d => <option key={d.id} value={d.name}>{d.name} ({d.code})</option>)}
                      </select>
                    ) : (
                      <input type="text" className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                        value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" />
                    )}
                  </div>
                </div>

                {/* Portal binding — edit mode only (create auto-fills from selected user) */}
                {formMode === 'edit' && (
                  <div className="space-y-1 pt-2 border-t border-neutral-100">
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-neutral-400 mb-1">
                      <UserCheck2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Portal Authentication Bindings</span>
                    </div>
                    <input type="email" className="w-full text-xs border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800 font-mono"
                      value={linkUserEmail} onChange={e => setLinkUserEmail(e.target.value)} placeholder="e.g. user-email@gmail.com" />
                    <p className="text-[10px] text-neutral-500 leading-normal pl-0.5 mt-1">
                      Entering the user's email grants them secure self-service portal clearance.
                    </p>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-150 text-red-600 text-xs rounded-md">
                    {errorMessage}
                  </div>
                )}

                <div className="p-2 bg-neutral-50 border border-neutral-150/60 rounded-md text-[10px] text-neutral-500 leading-normal flex items-start gap-1.5 pt-2 mb-4">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
                  <span>By registering, members are allocated empty Share Capital and Savings Accounts mapped immutably inside the Ledger.</span>
                </div>

                <div className="pt-4 border-t border-neutral-150 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="text-xs font-semibold text-neutral-500 hover:text-black py-2 px-4 border border-neutral-200 hover:border-neutral-300 rounded-md transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (formMode === 'create' && (!selectedUserId || !firstName || !lastName))}
                    className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-semibold py-2 px-4 rounded-md shadow-sm transition-all cursor-pointer"
                  >
                    {submitting ? 'Processing Transaction...' : formMode === 'create' ? 'Activate Profile' : 'Modify Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
